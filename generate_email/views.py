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
        emails = get_response(request.user, target, service)
        print("emails", emails)

        return JsonResponse({'success': True,'emails': emails})

