import base64
import datetime
from multiprocessing import context
from urllib import request
from django.urls import reverse
from django.shortcuts import render
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import FormView, View,TemplateView,ListView,DetailView
from django.http import JsonResponse
from .genai_email import get_response
from .models import TargetAudience, SentEmail, ReminderEmail, EmailSubscription
from users.models import ProductService, ActivityLog,Signature
import json
from django.http import HttpResponse
from django.db.models import Q
from .utils import sendGeneratedEmail, create_subscription, refresh_microsoft_token, MicrosoftEmailSendError
from django.shortcuts import get_object_or_404
from email.utils import make_msgid
from datetime import timedelta, date,datetime
from django.utils import timezone
from django.db.models import OuterRef, Subquery, DateField
from django.db.models.functions import Cast
from django.utils.timezone import now
import calendar
from allauth.socialaccount.models import SocialAccount, SocialToken
from .utils import send_email  # your updated email sending function
from saleswithai import settings
import time
from urllib.parse import quote, unquote
import numpy as np
import csv
import requests

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
    
    def format_signature(self, signature_obj, user):
        if not signature_obj or not signature_obj.signature:
            return ""
        raw_text= signature_obj.signature.strip()
        lines = [
            line.strip()
            for line in raw_text.splitlines()
            if line.strip()
        ]
        closing_phrases = {
            "best",
            "best regards",
            "kind regards",
            "regards",
            "thanks",
            "thank you",
            "sincerely"
        }
        if len(lines) == 1 and lines[0].lower().rstrip(',') in closing_phrases:
            lines[0] = lines[0].rstrip(',') + ","
            lines.extend([
                user.full_name,
                user.contact or "",
                user.company_name or ""
            ])
        html = "<p>" + "<br>".join(lines) + "</p>"

        if signature_obj.photo:
            html += f"""
                <p>
                    <img src="{signature_obj.photo.url}"
                        alt="Signature Photo"
                        style="max-width:420px;margin-top:8px;width:100%;height:auto;display:block;">
                </p>
            """
        return html

    def get(self, request):
         # Fetch the user's services for the dropdown
        user_services = ProductService.objects.filter(user=request.user).values_list('service_name', flat=True).distinct()
        signatures = Signature.objects.filter(user=request.user)
        google_accounts = SocialAccount.objects.filter(
            user=request.user,
            provider="google"
        )
        user = request.user

        total_sent = SentEmail.objects.filter(user=user).count()

        read_emails = SentEmail.objects.filter(
            user=user,
            opened=True
        ).count()

        unread_emails = SentEmail.objects.filter(
            user=user,
            opened=False
        ).count()

        today = timezone.now().date()

        today_opened = SentEmail.objects.filter(
            user=user,
            opened=True,
            opened_at__date=today
        ).count()

        # Percentages
        open_rate = round((read_emails / total_sent) * 100, 2) if total_sent else 0
        read_percentage = open_rate
        unread_percentage = round(100 - open_rate, 2) if total_sent else 0

        context = {
            "google_accounts": google_accounts,
            "user_services": user_services,
            "signatures": signatures,
            "title": "Home",
            "open_rate": open_rate,
            "today_opened": today_opened,
            "read_emails": read_emails,
            "unread_emails": unread_emails,
            "read_percentage": read_percentage,
            "unread_percentage": unread_percentage,
        }

        return render(request, 'generate_email/email_generator.html', context)


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
        signature_id = data.get('signature_id')

        # Selected Account Read
        selected_account_id = data.get("sent_from")  # <-- fetch from POST JSON

        if selected_account_id:
            google_account = SocialAccount.objects.get(
                id=selected_account_id,
                user=request.user,
                provider="google"
            )

            google_token = SocialToken.objects.get(account=google_account)

            sender_email = google_account.extra_data.get("email")
            access_token = google_token.token

            # Optional: log for debug
            logger.info(f"Selected Google Account: {sender_email} for user {request.user.id}")
        else:
            sender_email = None
            access_token = None

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

        signature_html = ""
        if signature_id:
            try:
                signature = Signature.objects.get(id=signature_id, user=request.user)
                signature_html = self.format_signature(
                    signature,
                    request.user
                )
            except Signature.DoesNotExist:
                signature_html = ""

        default_signature = (
            f"<p>Best,<br>"
            f"{request.user.full_name}"
            f"{'<br>' + request.user.contact if request.user.contact else ''}"
            f"<br>{request.user.company_name}</p>"
        )

        final_signature = signature_html or default_signature

        for email in emails['follow_ups']:
            email['body'] +=  final_signature or default_signature
    
        emails['main_email'][
            'body'] += final_signature or default_signature

        return JsonResponse({'success': True,'emails': emails, 'targetId':target.id,# Return normalized URLs to display in the UI
            'normalized_urls': {
                'company_url': company_url,
                'company_linkedin_url': company_linkedin_url,
                'receiver_linkedin_url': receiver_linkedin_url
            }})

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

        # ✅ Send main email
        sent_email = send_email(request, user, target, main_email)

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
from django.views.decorators.cache import never_cache
logger = logging.getLogger(__name__)

class EmailListView(LoginRequiredMixin, ListView):
    model = SentEmail
    template_name = 'generate_email/email_list.html'
    context_object_name = 'sent_emails'
   

    def parse_full_datetime(self, value):
        """
        13 Jan 2026, 05:58 pm
        """
        try:
            dt = datetime.strptime(value, "%d %b %Y, %I:%M %p")
            return timezone.make_aware(dt)
        except ValueError:
            return None
    def parse_natural_date(self, value):
        """
        13 jan
        13 jan 2026
        """
        parts = value.lower().split()

        if len(parts) not in (2, 3):
            return None
        month = day = year = None

        for part in parts:
            if part.isdigit():
                if len(part) == 4:
                    year = int(part)
                else:
                    day = int(part)
            else:
                try:
                    month = list(calendar.month_name).index(part.capitalize())
                except ValueError:
                    try:
                        month = list(calendar.month_abbr).index(part.capitalize())
                    except ValueError:
                        pass

        if not month or not day:
            return None

        if not year:
            year = timezone.now().year

        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None
        
    def parse_month(self, value):
        """
        jan, january
        """
        value = value.lower()
        for i in range(1, 13):
            if value in (
                calendar.month_name[i].lower(),
                calendar.month_abbr[i].lower()
            ):
                return i
        return None
    
    def get_queryset(self):
        search = self.request.GET.get('search', '').strip()

        today= timezone.now().date()
        next_reminder = ReminderEmail.objects.filter(
            sent_email=OuterRef('pk'),
            sent=False,
            # send_at__gte=now().date()
            send_at__gte=today
        ).order_by('send_at').values('send_at')[:1]

        qs = (
        SentEmail.objects
        .filter(user=self.request.user)
        .select_related('target_audience')
        .annotate(next_reminder_date=Subquery(next_reminder))
        .order_by('-created')
        )

        full_dt=self.parse_full_datetime(search)
        if full_dt:
            start = full_dt.replace(second=0, microsecond=0)
            end = start + timedelta(minutes=1)
            qs= qs.filter(created__gte=start, created__lt=end)
            return qs
        
        natural_date=self.parse_natural_date(search)
        if natural_date:
            qs= qs.filter(
                Q(created__date=natural_date) |
                Q(next_reminder_date=natural_date)
            )
            return qs
        
        month=self.parse_month(search)
        if month:
            qs= qs.filter(
                Q(created__month=month) |
                Q(next_reminder_date__month=month)
            )
            return qs

        if search:
            qs = qs.filter(
                Q(target_audience__email__icontains=search) |
                Q(subject__icontains=search) |
                Q(target_audience__receiver_first_name__icontains=search) |
                Q(target_audience__receiver_last_name__icontains=search)
            )
        return qs
    def render_to_response(self, context, **response_kwargs):
        if self.request.GET.get('ajax') == '1':
            emails = context['sent_emails'].values(
                'subject',
                'target_audience__email',
                'target_audience__receiver_first_name',
                'target_audience__receiver_last_name',
                'created',
                'next_reminder_date',
                'stop_reminder'
            )
            data = [
                {
                    'subject': e['subject'],
                    'email': e['target_audience__email'],
                    'name': f"{e['target_audience__receiver_first_name']} {e['target_audience__receiver_last_name']}",
                    'created': e['created'].strftime("%d %b %Y, %I:%M %p"),
                    'next_reminder_date': e['next_reminder_date'].strftime("%d %b %Y") if e['next_reminder_date'] else None,
                    'stop_reminder': e['stop_reminder'] 
                }
                for e in emails
            ]
            return JsonResponse(data, safe=False)
        return super().render_to_response(context, **response_kwargs)

    def post(self, request):
        data = json.loads(request.body)

        email_id = data.get("email_id")
        email = SentEmail.objects.get(id=email_id)
        email.stop_reminder = True
        email.save()

        return JsonResponse({'success': True})

class CheckEmailHistoryView(LoginRequiredMixin, View):
    def get(self, request, *args, **kwargs):
        email = request.GET.get("email")
        service=request.GET.get("service")

        if not email or not service:
            return JsonResponse(
                {"exists": False},
                status=400
            )

        last_email = (
            SentEmail.objects
            .filter(user=request.user, email=email,target_audience__selected_service=service)
            .select_related('target_audience')
            .order_by("-created")
            .first()
        )

        if last_email:
            return JsonResponse({
                "exists": True,
                "subject": last_email.subject,
                "service": last_email.target_audience.selected_service,
                "sent_at": last_email.created.strftime("%d %b %Y, %I:%M %p"),
            })

        return JsonResponse({"exists": False})
    
class LeadListView(LoginRequiredMixin, ListView):
    # model = SentEmail
    model = TargetAudience
    template_name = 'generate_email/lead_list.html'
    context_object_name = 'target_audience'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        base_qs = TargetAudience.objects.filter(user=self.request.user)

        context["service_options"] = [x for x in base_qs.values_list("selected_service", flat=True).distinct().order_by("selected_service") if x]
        context["framework_options"] = [x for x in base_qs.values_list("framework", flat=True).distinct().order_by("framework") if x]
        context["goal_options"] = [x for x in base_qs.values_list("campaign_goal", flat=True).distinct().order_by("campaign_goal") if x]

        return context
    
    def parse_natural_date(self, value):
        """
        13 jan
        13 jan 2026
        """
        parts = value.lower().split()

        if len(parts) not in (2, 3):
            return None
        month = day = year = None

        for part in parts:
            if part.isdigit():
                if len(part) == 4:
                    year = int(part)
                else:
                    day = int(part)
            else:
                try:
                    month = list(calendar.month_name).index(part.capitalize())
                except ValueError:
                    try:
                        month = list(calendar.month_abbr).index(part.capitalize())
                    except ValueError:
                        pass

        if not month or not day:
            return None

        if not year:
            year = timezone.now().year

        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None

    def get_queryset(self):
        search = self.request.GET.get('search', '').strip()
        service = self.request.GET.get('service', '').strip()
        framework = self.request.GET.get('framework', '').strip()
        goal = self.request.GET.get('goal', '').strip()
        last_days = self.request.GET.get('last_days', '').strip()

        qs = TargetAudience.objects.filter(user=self.request.user).order_by('-created')

        if service:
            qs = qs.filter(selected_service=service)
        if framework:
            qs = qs.filter(framework=framework)
        if goal:
            qs = qs.filter(campaign_goal=goal)
        if last_days.isdigit():
            days = int(last_days)
            qs = qs.filter(created__gte=timezone.now() - timedelta(days=days))

        natural_date=self.parse_natural_date(search)
        if natural_date:
            qs= qs.filter(created__date=natural_date)
            return qs

        if search:
            qs = qs.filter(
                Q(email__icontains=search) |
                Q(receiver_first_name__icontains=search) |
                Q(receiver_last_name__icontains=search)|
                Q(selected_service__icontains=search) |
                Q(framework__icontains=search)|
                Q(campaign_goal__icontains=search)|
                Q(company_url__icontains=search)
            )
        return qs

    def render_to_response(self, context, **response_kwargs):
        # Check for the ajax flag in the GET parameters
        if self.request.GET.get('ajax') == '1':
            leads = context['target_audience']
            data = [
                {
                    'id': lead.id,
                    'first_name': lead.receiver_first_name,
                    'last_name': lead.receiver_last_name,
                    'email': lead.email,
                    'linkedin_url': lead.receiver_linkedin_url,
                    'selected_service': lead.selected_service,
                    'company_url': lead.company_url,
                    'framework': lead.framework,
                    'campaign_goal': lead.campaign_goal,
                    'created': lead.created.strftime("%b %d, %Y"),
                    # Construct the URL for the clickable row
                    'view_url': reverse('view-leads-email', kwargs={'pk': lead.id})
                }
                for lead in leads
            ]
            return JsonResponse(data, safe=False)
        
        return super().render_to_response(context, **response_kwargs)
    

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

def get_message_details(user, msg_id):

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


@csrf_exempt
def email_open_pixel(request, uid):

    # 🚫 Ignore admin / logged-in users
    if request.user.is_authenticated:
        return transparent_pixel_response()

    # 🚫 Ignore Django admin preview
    referer = request.META.get("HTTP_REFERER", "")
    if "/admin/" in referer:
        return transparent_pixel_response()

    try:
        email = SentEmail.objects.get(uid=uid)

        if not email.opened:
            email.opened = True
            email.opened_at = timezone.now()
            email.opened_count = 1
        else:
            email.opened_count += 1

        email.save(update_fields=["opened", "opened_at", "opened_count"])

    except SentEmail.DoesNotExist:
        pass

    return transparent_pixel_response()


def transparent_pixel_response():
    pixel = (
        b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80'
        b'\x00\x00\x00\x00\x00\xff\xff\xff\x21\xf9\x04'
        b'\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01'
        b'\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b'
    )
    return HttpResponse(pixel, content_type='image/gif')
