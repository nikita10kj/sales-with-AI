from django.shortcuts import render
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.generic import FormView, View,TemplateView,ListView,DetailView
from django.http import JsonResponse
from .genai_email import get_response
from .models import TargetAudience, SentEmail, ReminderEmail
from users.models import ProductService, ActivityLog
import json
from django.http import HttpResponse

from .utils import sendGeneratedEmail
from django.shortcuts import get_object_or_404
from email.utils import make_msgid
from datetime import timedelta, date
from django.utils import timezone
from django.db.models import OuterRef, Subquery, DateField
from django.db.models.functions import Cast
from django.utils.timezone import now

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
        # emails = {
        #     'main_email':
        #         {
        #             'title': 'AIDA Framework Email',
        #             'subject': 'Transform Your Hiring Process with Our Expertise',
        #             'body': "<p>Hi Dhara Shah,</p><p>In today's competitive landscape, "
        #                     "finding the right talent is more crucial than ever. At JMS Advisory,"
        #                     " we specialize in streamlining the hiring process, ensuring "
        #                     "that companies like KnowCraft Analytics can focus on what they do "
        #                     "best—driving innovation and insights.</p><p>Our tailored recruitment "
        #                     "services are designed to meet your specific needs, helping you attract "
        #                     "top-tier candidates who align with your company culture and goals. "
        #                     "With our extensive network and expertise, we can significantly reduce "
        #                     "the time and resources spent on hiring.</p><p>Imagine having a dedicated "
        #                     "partner who understands the nuances of your industry and can "
        #                     "provide you with the best talent available. We have successfully assisted "
        #                     "numerous companies in enhancing their recruitment strategies, and we would "
        #                     "love to do the same for you.</p><p>Let’s discuss how we can collaborate to "
        #                     "elevate your hiring process. Are you available for a brief call this week?</p>"
        #                     "<p>Looking forward to your response!</p>"
        #         },
        #     'follow_ups':
        #         [
        #             {
        #                 'subject': 'Following Up on My Previous Email',
        #                 'body': '<p>Hi Dhara Shah,</p><p>I wanted to follow up on my previous email '
        #                         'regarding our recruitment services. I believe that JMS Advisory '
        #                         'can add significant value to KnowCraft Analytics by optimizing your '
        #                         'hiring process.</p><p>Have you had a chance to consider our'
        #                         ' proposal? I would be happy to provide more details or answer any '
        #                         'questions you might have.</p><p>Looking forward to hearing from you!</p>'
        #             },
        #             {
        #                 'subject': 'Still Interested in Enhancing Your Hiring Process?',
        #                 'body': '<p>Hi Dhara Shah,</p><p>I hope this message finds you well! '
        #                         'I wanted to check in again regarding our recruitment services. '
        #                         'Our clients have seen remarkable improvements in their hiring '
        #                         'efficiency and candidate quality.</p><p>Would you be open to a '
        #                         'quick chat to explore how we can assist KnowCraft Analytics in '
        #                         'achieving similar results?</p><p>Thank you for considering!</p>'
        #             },
        #             {
        #                 'subject': 'Last Chance to Optimize Your Recruitment Strategy',
        #                 'body': "<p>Hi Dhara Shah,</p><p>This will be my final follow-up regarding our"
        #                         " recruitment services. I truly believe that JMS Advisory can help"
        #                         " KnowCraft Analytics streamline your hiring process and attract the "
        #                         "right talent.</p><p>If you're interested, I would love to schedule a "
        #                         "call to discuss this further. Please let me know a time that works for"
        #                         " you!</p><p>Thank you for your time!</p>"
        #             },
        #             {
        #                 'subject': "Final Reminder: Let's Connect!",
        #                 'body': "<p>Hi Dhara Shah,</p><p>I wanted to reach out one last time to"
        #                         " see if you would be interested in discussing how JMS Advisory"
        #                         " can support KnowCraft Analytics in enhancing your hiring process.</p>"
        #                         "<p>Even if now isn't the right time, I would appreciate any feedback"
        #                         " or thoughts you may have.</p>"
        #                         "<p>Thank you, and I hope to hear from you soon!</p>"
        #             }
        #         ]
        # }
        for email in emails['follow_ups']:
            email['body'] += (f"<p>Best Regards,<br>{request.user.full_name}"
                              f"{'<br>' + request.user.contact if request.user.contact else ''}"
                              f"<br>{request.user.company_name}</p>")
        emails['main_email'][
            'body'] += (f"<p>Best Regards,<br>{request.user.full_name}"
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
            day = days[index]
            send_date = add_business_days_np(today, day)
            subject = f'Re:{main_email["subject"]}'
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
