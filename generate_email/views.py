from allauth.socialaccount.models import SocialToken
from django.shortcuts import render
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import FormView, View,TemplateView,ListView,DetailView
from django.http import JsonResponse
from .genai_email import get_response
from .models import TargetAudience, SentEmail, ReminderEmail, EmailSubscription
from users.models import ProductService, ActivityLog
import json
from django.http import HttpResponse

from .utils import sendGeneratedEmail, create_subscription, refresh_microsoft_token, MicrosoftEmailSendError
from django.shortcuts import get_object_or_404
from email.utils import make_msgid
from datetime import timedelta, date
from django.utils import timezone
from django.db.models import OuterRef, Subquery, DateField
from django.db.models.functions import Cast
from django.utils.timezone import now
from allauth.socialaccount.models import SocialToken
from django.utils import timezone

# def get_latest_microsoft_token(user):
#     """
#     Safely returns the most recent Microsoft SocialToken for a user.
#     Deletes older duplicates automatically.
#     """
#     tokens = SocialToken.objects.filter(
#         account__user=user,
#         account__provider='microsoft'
#     ).order_by('-expires_at')

#     if not tokens.exists():
#         return None

#     latest = tokens.first()

#     # Optionally clean up duplicates
#     tokens.exclude(id=latest.id).delete()

#     # If token expired — try refreshing
#     if latest.expires_at and latest.expires_at <= timezone.now():
#         from .utils import refresh_microsoft_token
#         new_token = refresh_microsoft_token(user)
#         if not new_token:
#             raise Exception("Microsoft token refresh failed")
#         return new_token

#     return latest.token
def get_latest_microsoft_token(user):
    try:
        token = SocialToken.objects.filter(
            account__user=user,
            account__provider="microsoft"
        ).first()

        if not token:
            return None

        if token.expires_at and token.expires_at <= timezone.now():
            new_token = refresh_microsoft_token(user)
            if not new_token:
                logger.warning(
                    "Microsoft token refresh failed for user_id=%s",
                    user.id
                )
                return None
            return new_token

        return token.token

    except Exception:
        logger.exception("Microsoft token lookup failed")
        return None
        
# Create your views here.
class GenerateEmailView(LoginRequiredMixin, View):
    def normalize_url(self, url):
        """Ensure the URL starts with http:// or https://"""
        if url and not url.startswith(('http://', 'https://')):
            return f'https://{url.strip()}'
        return url.strip() if url else ''

    def get(self, request):
         # Fetch the user's services for the dropdown
        user_services = ProductService.objects.filter(user=request.user).values_list('service_name', flat=True).distinct()
        return render(request, 'generate_email/email_generator.html', {'title': "Home",'user_services': user_services})


    def post(self, request, *args, **kwargs):
        data = json.loads(request.body)

        email = data.get('email')
        receiver_first_name = data.get('receiver_first_name')
        receiver_last_name = data.get('receiver_last_name')
        company_linkedin_url = self.normalize_url(data.get('company_linkedin_url', ''))
        receiver_linkedin_url = self.normalize_url(data.get('receiver_linkedin_url', ''))
        selected_service = data.get('selected_service')
        company_url = self.normalize_url(data.get('company_url', ''))
        framework = data.get('framework')
        campaign_goal = data.get('campaign_goal')

        if selected_service:
            service = ProductService.objects.get(user=request.user, service_name=selected_service)
        else:
            service = ProductService.objects.filter(user=request.user).first()

        # Only count SentEmails that do NOT have a corresponding ReminderEmail
        if request.user.email.split('@')[-1] != "jmsadvisory.in":
            sent_emails = SentEmail.objects.filter(user=request.user).exclude(
                id__in=ReminderEmail.objects.filter(sent_email=OuterRef('pk')).values('sent_email')
            )
            if sent_emails.count() >= 50 :
                return JsonResponse({'success': False, 'errors': "You have Exceeded limit of 50 emails."})
        target, _ = TargetAudience.objects.get_or_create(
            user=request.user,
            email=email,
            receiver_first_name=receiver_first_name,
            receiver_last_name=receiver_last_name,
            receiver_linkedin_url=receiver_linkedin_url,
            selected_service=selected_service,
            company_url=company_url,
            framework=framework,
            campaign_goal=campaign_goal
        )
        emails = json.loads(get_response(request.user, target, service))

        for email in emails['follow_ups']:
            email['body'] += (f"<p>Best,<br>{request.user.full_name}"
                              f"{'<br>' + request.user.contact if request.user.contact else ''}"
                              f"<br>{request.user.company_name}</p>")
        emails['main_email'][
            'body'] += (f"<p>Best,<br>{request.user.full_name}"
                        f"{'<br>' + request.user.contact if request.user.contact else ''}"
                        f"<br>{request.user.company_name}</p>")

        return JsonResponse({'success': True,'emails': emails, 'targetId':target.id,# Return normalized URLs to display in the UI
            'normalized_urls': {
                'company_url': company_url,
                'company_linkedin_url': company_linkedin_url,
                'receiver_linkedin_url': receiver_linkedin_url
            }})

import numpy as np

def add_business_days_np(start_date, n_days):
    # Convert to numpy datetime64
    start_np = np.datetime64(start_date)
    # Use numpy's busday_offset
    result = np.busday_offset(start_np, n_days, roll='forward')
    return result.astype('M8[D]').astype(object)

class SendEmailView(LoginRequiredMixin, View):
    def get(self, request):
        return render(request, 'generate_email/email_generator.html', {'title': "Home"})

    def post(self, request, *args, **kwargs):
        data = json.loads(request.body)

        emails = data.get("emails")
        targetId = data.get("targetId")
        target = TargetAudience.objects.get(id=targetId)
        main_email = emails["main_email"]
        followup_emails = emails["follow_ups"]

        #for restriction more than 500 user    
        user = request.user
        user_email = user.email.lower() if user.email else ""
        organization_domain = "jmsadvisory"

        # ✅ Check if user is from your organization
        if organization_domain not in user_email:
            # Count how many emails this user has already sent
            sent_count = SentEmail.objects.filter(user=user).count()

            if sent_count >= 500:
                return JsonResponse({
                    'success': False,
                    'error': 'Email limit reached. You can only send up to 500 emails.'
                }, status=403)

        sent_email = sendGeneratedEmail(request, request.user, target, main_email)
        ActivityLog.objects.get_or_create(
            user=request.user,
            action="EMAIL_SENT",
            description=f"{target.framework} Email sent to {target.email}"
        )
        message_id = make_msgid(domain='sellsharp.co')
        today = date.today()
        days = [3, 5, 7, 10]
        reminders = []
        index = 0

        for fe in followup_emails:
            day = int(fe.get("day", days[index] if index < len(days) else 3))

            send_date = add_business_days_np(today, day)
            subject = main_email["subject"]
            reminder, created = ReminderEmail.objects.get_or_create(
                user=request.user,
                email=target.email,
                sent_email=sent_email,
                target_audience=target,
                subject=subject,
                message=fe["body"],
                send_at=send_date,
                message_id=message_id
            )
            reminders.append({
                'subject': subject,
                'send_date': send_date.strftime("%B %d, %Y"),
                'days_after': day
            })
            index += 1

        return JsonResponse({
            'success': True,
            'reminders': reminders,
            'main_email_sent': True,
            'target_email': target.email
        })

import logging
logger = logging.getLogger(__name__)
def track_email_open(request, uid):
    logger.info(f"Pixel hit: UID={uid}, IP={request.META.get('REMOTE_ADDR')}, Auth={request.user.is_authenticated}, Source={request.GET.get('source')}")

    # Avoid tracking if user is logged in (e.g., reading from your own UI)
    if request.user.is_authenticated:
        pixel = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01'
            b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
            b'\x00\x00\x00\nIDATx\xdac\xf8\xff\xff?\x00\x05\xfe\x02'
            b'\xfeA\xe2 \xa1\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        return HttpResponse(pixel, content_type='image/png')
    # Log the open event (use a unique ID for each email)
    try:
        tracker = SentEmail.objects.get(uid=uid)
        tracker.opened = True
        ActivityLog.objects.get_or_create(
            user=tracker.user,
            action="EMAIL_OPENED",
            description=f"{tracker.target_audience.email} opened email"
        )
        tracker.save()
    except SentEmail.DoesNotExist:
        pass

    # Return a transparent 1x1 PNG
    pixel = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01' \
            b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89' \
            b'\x00\x00\x00\nIDATx\xdac\xf8\xff\xff?\x00\x05\xfe\x02' \
            b'\xfeA\xe2 \xa1\x00\x00\x00\x00IEND\xaeB`\x82'
    return HttpResponse(pixel, content_type='image/png')


class EmailListView(LoginRequiredMixin, ListView):
    model = SentEmail
    template_name = 'generate_email/email_list.html'
    context_object_name = 'sent_emails'
   

    def get_queryset(self):

        next_reminder = ReminderEmail.objects.filter(
            sent_email=OuterRef('pk'),
            send_at__gte=now().date()
        ).order_by('send_at').values('send_at')[:1]
        
        # Show only emails sent by the logged-in user, newest first
        return (
            SentEmail.objects
            .filter(user=self.request.user)
            .select_related('target_audience')
            .annotate(next_reminder_date=Subquery(next_reminder))
            .order_by('-created')
        )

    def post(self, request):
        data = json.loads(request.body)

        email_id = data.get("email_id")
        email = SentEmail.objects.get(id=email_id)
        email.stop_reminder = True
        email.save()

        return JsonResponse({'success': True})


class LeadListView(LoginRequiredMixin, ListView):
    model = SentEmail
    template_name = 'generate_email/lead_list.html'
    context_object_name = 'target_audience'

    def get_queryset(self):
        target_audience = TargetAudience.objects.filter(user=self.request.user).order_by('-created')

        # Show only emails sent by the logged-in user, newest first
        return target_audience

# views.py
import csv
from django.http import HttpResponse
from .models import TargetAudience  # Update with your model name


def escape_csv(value):
    """
    Escapes potentially dangerous values for CSV injection.
    """
    if isinstance(value, str) and value.startswith(('=', '+', '-', '@')):
        return "'" + value  # Prepend with single quote to disable formula
    return value

def export_target_audience_csv(request):
    response = HttpResponse(content_type='text/csv')
    today = timezone.now().date()
    filename = f"Lead-List-{today}.csv"
    response['Content-Disposition'] = f'attachment; filename={filename}'

    writer = csv.writer(response)
    headers = [
        'Name', 'Email', 'LinkedIn URL', 'For Service', 'Company Website',
        'Framework', 'Goal of Campaign', 'Last Connected'
    ]
    writer.writerow([escape_csv(header) for header in headers])

    target_audience = TargetAudience.objects.filter(user=request.user).order_by('-created')  # Add filters if needed

    for ta in target_audience:
        row = [
            f"{ta.receiver_first_name} {ta.receiver_last_name}",
            ta.email,
            ta.receiver_linkedin_url,
            ta.selected_service,
            ta.company_url,
            ta.framework,
            ta.campaign_goal,
            ta.created.strftime("%Y-%m-%d"),
        ]
        writer.writerow([escape_csv(cell) for cell in row])

    return response


class LeadEmailListView(LoginRequiredMixin, ListView):
    model = SentEmail
    template_name = 'generate_email/leads_email_list.html'
    context_object_name = 'target_audience_email'

    def get_queryset(self):
        pk = self.kwargs.get('pk')
        self.target_audience = TargetAudience.objects.get(pk=pk)
        next_reminder = ReminderEmail.objects.filter(
            sent_email=OuterRef('pk'),
            send_at__gte=now().date()
        ).order_by('send_at').values('send_at')[:1]
        # Show only emails sent by the logged-in user, newest first
        return (self.target_audience.sent_email.
                annotate(next_reminder_date=Subquery(next_reminder)).order_by('-created'))


    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['target_audience'] = self.target_audience
        return context

class EmailMessageView(DetailView):
    model = SentEmail
    template_name = 'generate_email/email_message.html'
    context_object_name = 'email'

    def get_object(self):
        return get_object_or_404(SentEmail, uid=self.kwargs['uid'], user=self.request.user)
    
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        sent_email = self.object  # already fetched by DetailView using get_object
        context['reminders'] = ReminderEmail.objects.filter(
            sent_email=sent_email,
            sent=True
        ).order_by('send_at')
        return context

from saleswithai import settings
import time
from urllib.parse import quote, unquote

@csrf_exempt
def msgraph_webhook(request):
    start_time = time.time()
    print("MS Graph request arrived at", timezone.now(), "method:", request.method)
    # Step 1: Handle validation (GET or POST with validationToken)
    validation_token = request.GET.get("validationToken")
    if not validation_token and request.method == "POST":

        # In POST validation, token is sent in the query string too
        validation_token = request.GET.get("validationToken")
    if validation_token:
        return HttpResponse(validation_token, content_type="text/plain", status=200)

    # Step 2: Handle actual notifications
    if request.method == "POST":
        try:
            data = json.loads(request.body.decode('utf-8') or '{}')
            for change in data.get('value', []):
                # validate clientState matches
                if change.get('clientState') != settings.MS_GRAPH_CLIENT_STATE:
                    continue
                # resource e.g. "users/{id}/messages/{msgId}"

                try:

                    msg_id = change.get('resourceData', {}).get('id')
                    sub_id = change.get("subscriptionId")
                    sub = EmailSubscription.objects.get(subscription_id=sub_id)
                    user = sub.user
                    # message_data = get_message_details(user, msg_id)
                    try:
                        message_data = get_message_details(user, msg_id)
                    except Exception:
                        logger.exception("Webhook-safe Graph failure")
                        continue


                    if not message_data or not isinstance(message_data, dict):
                        logger.warning("MS Graph webhook returned no message data for msg_id=%s", msg_id)
                        continue

                    # in_reply_to = message_data.get('value',[])[0]["conversationId"]
                    value_list = message_data.get('value', [])

                    if not value_list:
                        # Handle gracefully, e.g., skip or log the event
                        logger.warning("MS Graph webhook received empty 'value' list: %s", message_data)
                        return JsonResponse({"status": "ignored"}, status=200)

                    in_reply_to = value_list[0].get("conversationId")


                    for email in SentEmail.objects.filter(user=user):
                        reminder_qs = email.reminder_email.all()
                        if reminder_qs.exists():

                            sent_msg_id = email.message_id
                            if sent_msg_id.startswith("AA"):
                                conversation_id = get_conversation_id(user, sent_msg_id)

                                if conversation_id == in_reply_to:

                                    email.stop_reminder = True
                                    email.save()
                except EmailSubscription.DoesNotExist:
                    continue  # unknown subscription


        except json.JSONDecodeError:
            return HttpResponse(status=400)

        # TODO: Check if message is a reply, update DB, etc.
        return HttpResponse(status=202)


    return HttpResponse(status=405)

import requests

# def get_message_details(user, msg_id):

#     token = SocialToken.objects.get(account__user=user, account__provider='microsoft')

#     # Check if token is expired
#     if token.expires_at and token.expires_at <= timezone.now():
#         new_token = refresh_microsoft_token(user)
#         if not new_token:
#             raise MicrosoftEmailSendError("Microsoft token refresh failed")
#         access_token = new_token
#         print("new")
#     else:
#         access_token = token.token
#     # msg_id = "AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AMZFau0IUOUmcRpqAeOGh6wABWFX3OQAA"
#     url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}?$select=internetMessageHeaders"
#     # url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}"
#     # print("access", access_token)
#     headers = {"Authorization": f"Bearer {access_token}"}
#     try:
#         resp = requests.get(url, headers=headers)
#         resp.raise_for_status()
#         # conversationId = resp.json().get("conversationId")
#         # conversationId = quote(conversationId)
#         data = resp.json()
#         # print("data :", data)

#         # Extract headers
#         in_reply_to = ""
#         for header in data.get("internetMessageHeaders", []):
#             if header["name"].lower() in ["in-reply-to", "references"]:
#                 in_reply_to = header['value']
#                 # print(f"{header['name']}: {header['value']}")
#         # print("con", conversationId)
#         base_url = f"https://graph.microsoft.com/v1.0/me/messages?$filter=internetMessageId eq '{in_reply_to}'"
#         # # params = {
#         # #     "$filter": f"conversationId eq '{conversationId}'",
#         # #     "$orderby": "receivedDateTime"
#         # # }
#         resp1 = requests.get(base_url, headers=headers)
#         resp1.raise_for_status()
#         return resp1.json()
#     except requests.HTTPError as e:
#         if e.response.status_code == 404:
#             return None

def get_message_details(user, msg_id):
    from .utils import MicrosoftEmailSendError
    import requests

    # access_token = get_latest_microsoft_token(user)
    # if not access_token:
    #     raise MicrosoftEmailSendError("No Microsoft token found for this user")
    access_token = get_latest_microsoft_token(user)

    if not access_token:
        logger.warning(
            "MS Graph webhook: no access token for user_id=%s",
            user.id
        )
        return None


    url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}?$select=internetMessageHeaders"
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        resp = requests.get(url, headers=headers)
        resp.raise_for_status()

        data = resp.json()

        # Extract 'in-reply-to' message header
        in_reply_to = ""
        for header in data.get("internetMessageHeaders", []):
            if header["name"].lower() in ["in-reply-to", "references"]:
                in_reply_to = header['value']

        if not in_reply_to:
            return None

        # Query original conversation
        base_url = f"https://graph.microsoft.com/v1.0/me/messages?$filter=internetMessageId eq '{in_reply_to}'"
        resp1 = requests.get(base_url, headers=headers)
        resp1.raise_for_status()
        return resp1.json()

    except requests.HTTPError as e:
        if e.response.status_code == 404:
            return None
        raise

    # messages = resp1.json().get("value", [])
    # get_url = f"https://graph.microsoft.com/v1.0/me/messages?$filter=conversationId eq '{conversationId}'&$orderby=receivedDateTime"
    # resp1 = requests.get(get_url, headers=headers)
    # resp1.raise_for_status()


# AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AMZFau0IUOUmcRpqAeOGh6wABWFX3OQAA

# 'conversationId': 'AAQkAGRiNDg0OTg1LWIwZmUtNGIzMi1hOGM1LTk5MWE1ODU3ZjA0ZgAQALuRXNnrgZNNuXTkW2wsHEw='

# def get_conversation_id(user, msg_id):

#     token = SocialToken.objects.get(account__user=user, account__provider='microsoft')

#     # Check if token is expired
#     if token.expires_at and token.expires_at <= timezone.now():
#         new_token = refresh_microsoft_token(user)
#         if not new_token:
#             raise MicrosoftEmailSendError("Microsoft token refresh failed")
#         access_token = new_token
#         print("new")
#     else:
#         access_token = token.token
#     # msg_id = "AAkALgAAAAAAHYQDEapmEc2byACqAC-EWg0AMZFau0IUOUmcRpqAeOGh6wABWFX3OQAA"
#     # url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}?$select=internetMessageHeaders"
#     url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}"
#     # print("access", access_token)
#     headers = {"Authorization": f"Bearer {access_token}"}
#     resp = requests.get(url, headers=headers)
#     if resp.status_code == 404:
#         # Message not found — skip / handle gracefully
#         print(f"Message {msg_id} not found, skipping.")
#         return None
#     resp.raise_for_status()
#     # conversationId = resp.json().get("conversationId")
#     # conversationId = quote(conversationId)
#     data = resp.json()
#     # print("conversation ", data)
#     if "conversationId" in data:
#         return data["conversationId"]

#         # If response is paginated or wrapped in 'value'
#     if "value" in data and data["value"]:
#         return data["value"][0].get("conversationId")
#     return None

def get_conversation_id(user, msg_id):
    import requests

    access_token = get_latest_microsoft_token(user)
    if not access_token:
        return None

    url = f"https://graph.microsoft.com/v1.0/me/messages/{msg_id}"
    headers = {"Authorization": f"Bearer {access_token}"}

    resp = requests.get(url, headers=headers)
    if resp.status_code == 404:
        print(f"Message {msg_id} not found, skipping.")
        return None

    resp.raise_for_status()
    data = resp.json()

    if "conversationId" in data:
        return data["conversationId"]

    if "value" in data and data["value"]:
        return data["value"][0].get("conversationId")

    return None
