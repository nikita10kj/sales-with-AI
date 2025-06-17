from django.shortcuts import render
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.generic import FormView, View,TemplateView
from django.http import JsonResponse
from .genai_email import get_response
from .models import TargetAudience
from users.models import ProductService
import json


# Create your views here.
class GenerateEmailView(LoginRequiredMixin, View):
    def get(self, request):
        return render(request, 'generate_email/email_generator.html', {'title': "Home"})


    def post(self, request, *args, **kwargs):
        data = json.loads(request.body)
        print("data", data)

        email = data.get('email')
        receiver_first_name = data.get('receiver_first_name')
        receiver_last_name = data.get('receiver_last_name')
        company_linkedin_url = data.get('company_linkedin_url')
        receiver_linkedin_url = data.get('receiver_linkedin_url')
        selected_service = data.get('selected_service')
        company_url = data.get('company_url')
        framework = data.get('framework')
        campaign_goal = data.get('campaign_goal')
        print("email", email)

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
        # emails = get_response(request.user, target, service)
        emails = {
                "main_email": {
                    "title": "Unlock Exceptional Talent with Our Hiring Solutions",
                    "subject": "Transform Your Hiring Process with JMS Advisory",
                    "body": "Hi Nikita,\n\nI hope this message finds you well! At JMS Advisory, we understand that finding the right talent can be a daunting task, especially in today’s competitive landscape. \n\n**Attention:** Did you know that companies that invest in effective recruitment strategies see a 70% increase in employee retention? \n\n**Interest:** Our specialized recruitment services are designed to streamline your hiring process, ensuring you attract and retain the best candidates tailored to your unique business needs. With our extensive network and expertise, we can help you reduce hiring time and improve the quality of your hires. \n\n**Desire:** Imagine having a dedicated team that not only understands your industry but also shares your vision for growth. Our proven methodologies and personalized approach can make that a reality, allowing you to focus on what truly matters—growing your business. \n\n**Action:** I would love to discuss how our services can specifically benefit JMS Advisory. Are you available for a quick call this week? You can also check out our recruitment services here: https://jmsadvisory.in/recruitment-services/\n\nLooking forward to connecting!\n\nBest regards,\nHemish Pansuriya\n[Your Position]\nMeta AI\n[Your Contact Information]"
                },
                "follow_ups": [
                    {
                        "subject": "Just Checking In!",
                        "body": "Hi Nikita,\n\nI wanted to follow up on my previous email regarding our recruitment services. Have you had a chance to consider how JMS Advisory can assist in enhancing your hiring process? \n\nLet me know if you’d like to schedule a brief chat!\n\nBest,\nHemish"
                    },
                    {
                        "subject": "Unlock the Potential of Your Hiring Strategy",
                        "body": "Hi Nikita,\n\nI hope you’re having a great week! I wanted to share a success story of one of our clients who transformed their hiring process with our services, resulting in a 50% reduction in time-to-hire. \n\nWould you be interested in learning how we can achieve similar results for JMS Advisory?\n\nBest,\nHemish"
                    },
                    {
                        "subject": "Your Hiring Challenges Solved",
                        "body": "Hi Nikita,\n\nI understand that hiring can be challenging, especially with the current market dynamics. Our tailored recruitment solutions are designed to address these challenges head-on. \n\nCan we set up a time to discuss your specific needs?\n\nBest,\nHemish"
                    },
                    {
                        "subject": "Last Chance to Elevate Your Hiring Process",
                        "body": "Hi Nikita,\n\nI wanted to reach out one last time to see if you’re interested in exploring our recruitment services. We’re passionate about helping companies like JMS Advisory find the right talent efficiently. \n\nIf you’re open to it, I’d love to chat!\n\nBest,\nHemish"
                    }
                ]
            }

        print("emails", emails)

        return JsonResponse({'success': True,'emails': emails})

