from django.shortcuts import render
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.generic import FormView, View,TemplateView
from django.http import JsonResponse
from .genai_email import get_response
from .models import TargetAudience, SentEmail
from users.models import ProductService
import json
from django.http import HttpResponse

from .utils import sendGeneratedEmail


# Create your views here.
class GenerateEmailView(LoginRequiredMixin, View):
    def get(self, request):
        return render(request, 'generate_email/email_generator.html', {'title': "Home"})


    def post(self, request, *args, **kwargs):
        data = json.loads(request.body)

        email = data.get('email')
        receiver_first_name = data.get('receiver_first_name')
        receiver_last_name = data.get('receiver_last_name')
        company_linkedin_url = data.get('company_linkedin_url')
        receiver_linkedin_url = data.get('receiver_linkedin_url')
        selected_service = data.get('selected_service')
        company_url = data.get('company_url')
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
            company_linkedin_url=company_linkedin_url,
            receiver_linkedin_url=receiver_linkedin_url,
            selected_service=selected_service,
            company_url=company_url,
            framework=framework,
            campaign_goal=campaign_goal
        )
        # emails = json.loads(get_response(request.user, target, service))
        emails = {
            'main_email':
                {
                    'title': 'AIDA Framework Email',
                    'subject': 'Transform Your Hiring Process with Our Expertise',
                    'body': "<p>Hi Dhara Shah,</p><p>In today's competitive landscape, "
                            "finding the right talent is more crucial than ever. At JMS Advisory,"
                            " we specialize in streamlining the hiring process, ensuring "
                            "that companies like KnowCraft Analytics can focus on what they do "
                            "best—driving innovation and insights.</p><p>Our tailored recruitment "
                            "services are designed to meet your specific needs, helping you attract "
                            "top-tier candidates who align with your company culture and goals. "
                            "With our extensive network and expertise, we can significantly reduce "
                            "the time and resources spent on hiring.</p><p>Imagine having a dedicated "
                            "partner who understands the nuances of your industry and can "
                            "provide you with the best talent available. We have successfully assisted "
                            "numerous companies in enhancing their recruitment strategies, and we would "
                            "love to do the same for you.</p><p>Let’s discuss how we can collaborate to "
                            "elevate your hiring process. Are you available for a brief call this week?</p>"
                            "<p>Looking forward to your response!</p>"
                },
            'follow_ups':
                [
                    {
                        'subject': 'Following Up on My Previous Email',
                        'body': '<p>Hi Dhara Shah,</p><p>I wanted to follow up on my previous email '
                                'regarding our recruitment services. I believe that JMS Advisory '
                                'can add significant value to KnowCraft Analytics by optimizing your '
                                'hiring process.</p><p>Have you had a chance to consider our'
                                ' proposal? I would be happy to provide more details or answer any '
                                'questions you might have.</p><p>Looking forward to hearing from you!</p>'
                    },
                    {
                        'subject': 'Still Interested in Enhancing Your Hiring Process?',
                        'body': '<p>Hi Dhara Shah,</p><p>I hope this message finds you well! '
                                'I wanted to check in again regarding our recruitment services. '
                                'Our clients have seen remarkable improvements in their hiring '
                                'efficiency and candidate quality.</p><p>Would you be open to a '
                                'quick chat to explore how we can assist KnowCraft Analytics in '
                                'achieving similar results?</p><p>Thank you for considering!</p>'
                    },
                    {
                        'subject': 'Last Chance to Optimize Your Recruitment Strategy',
                        'body': "<p>Hi Dhara Shah,</p><p>This will be my final follow-up regarding our"
                                " recruitment services. I truly believe that JMS Advisory can help"
                                " KnowCraft Analytics streamline your hiring process and attract the "
                                "right talent.</p><p>If you're interested, I would love to schedule a "
                                "call to discuss this further. Please let me know a time that works for"
                                " you!</p><p>Thank you for your time!</p>"
                    },
                    {
                        'subject': "Final Reminder: Let's Connect!",
                        'body': "<p>Hi Dhara Shah,</p><p>I wanted to reach out one last time to"
                                " see if you would be interested in discussing how JMS Advisory"
                                " can support KnowCraft Analytics in enhancing your hiring process.</p>"
                                "<p>Even if now isn't the right time, I would appreciate any feedback"
                                " or thoughts you may have.</p>"
                                "<p>Thank you, and I hope to hear from you soon!</p>"
                    }
                ]
        }
        for email in emails['follow_ups']:
            email['body'] += f"<p>Best Regards,<br>{request.user.full_name}<br>{request.user.company_name}</p>"
        emails['main_email'][
            'body'] += f"<p>Best Regards,<br>{request.user.full_name}<br>{request.user.company_name}</p>"

        return JsonResponse({'success': True,'emails': emails, 'targetId':target.id})

class SendEmailView(LoginRequiredMixin, View):
    def get(self, request):
        return render(request, 'generate_email/email_generator.html', {'title': "Home"})

    def post(self, request, *args, **kwargs):
        data = json.loads(request.body)

        emails = data.get("emails")
        targetId = data.get("targetId")
        target = TargetAudience.objects.get(id=targetId)
        main_email = emails["main_email"]
        sendGeneratedEmail(request, request.user, target, main_email)
        return JsonResponse({'success': True})

def track_email_open(request, uid):
    # Log the open event (use a unique ID for each email)
    try:
        tracker = SentEmail.objects.get(uid=uid)
        print("opened")
        tracker.opened = True
        tracker.save()
    except SentEmail.DoesNotExist:
        pass

    # Return a transparent 1x1 PNG
    pixel = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01' \
            b'\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89' \
            b'\x00\x00\x00\nIDATx\xdac\xf8\xff\xff?\x00\x05\xfe\x02' \
            b'\xfeA\xe2 \xa1\x00\x00\x00\x00IEND\xaeB`\x82'
    return HttpResponse(pixel, content_type='image/png')


