from django.shortcuts import render

# Create your views here.
from django.contrib.auth.decorators import login_required
from django.views.generic import FormView, View,TemplateView
from django.contrib.auth import login, authenticate
from django.contrib import messages
from .models import EmailOTP, CustomUser,ProductService
from .forms import EmailForm, OTPForm
from .utils import sendOTP
from django.contrib.auth.views import PasswordResetView

from django.utils.timezone import now
from datetime import timedelta
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.generic.edit import UpdateView

from django.urls import reverse_lazy
import os, json

from django.conf import settings
from django.shortcuts import redirect, get_object_or_404

from django.views.decorators.csrf import requires_csrf_token
from django.http import HttpResponseForbidden
from django.core.validators import URLValidator, EmailValidator
from django.core.exceptions import ValidationError

@requires_csrf_token
def csrf_failure(request, reason=""):
    # Redirect to login page with error message
    messages.error(request, "Invalid session. Please log in again.")
    return redirect('login')

class HomeView(LoginRequiredMixin, TemplateView):
    template_name = 'users/dashboard.html'
    title = "Home"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title

        return context

# class AnalyticsView(LoginRequiredMixin, TemplateView):
#     template_name = 'users/dashboard.html'
#     title = "Analytics"

#     def get_context_data(self, **kwargs):
#         context = super().get_context_data(**kwargs)
#         context["title"] = self.title

#         return context



class RegisterView(FormView):
    template_name = 'users/register.html'
    form_class = EmailForm
    title = "Sign Up"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title

        return context

    def form_valid(self, form):
        email = form.cleaned_data['email'].lower()
        if CustomUser.objects.filter(email=email).exists():
            form.add_error('email', 'Email already registered. Try login.')
            return self.form_invalid(form)

        sendOTP(email)

        self.request.session['otp_email'] = email
        messages.success(self.request, 'OTP has been sent to your email.')
        return redirect('verify-otp')


class LoginView(FormView):
    template_name = 'users/login.html'
    form_class = EmailForm
    title = "Sign In"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title

        return context

    def form_valid(self, form):
        email = form.cleaned_data['email'].lower()
        if not CustomUser.objects.filter(email=email).exists():
            form.add_error('email', 'Email not registered. Try registering.')
            return self.form_invalid(form)

        sendOTP(email)
        messages.success(self.request, "OTP has been sent to your email.")

        self.request.session['otp_email'] = email

        return redirect('verify-otp')


class VerifyOTPView(FormView):
    # verify with OTP or Password Login for Admin & Manager
    template_name = 'users/otp.html'
    form_class = OTPForm
    title = "Sign In"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title

        return context

    def get_initial(self):
        return {'email': self.request.session.get('otp_email')}

    def form_valid(self, form):
        email = form.cleaned_data['email']
        otp_input = form.cleaned_data['otp']

        try:
            latest_otp = EmailOTP.objects.filter(email=email).latest('created_at')
        except EmailOTP.DoesNotExist:
            form.add_error(None, "Invalid OTP.")
            return self.form_invalid(form)

        if latest_otp.otp == otp_input and latest_otp.is_valid():

            user, created = CustomUser.objects.get_or_create(email=email)
            if created:
                redirect_url = reverse_lazy('user-details', kwargs={'pk': user.id})
            else:
                if user.full_name:
                    redirect_url = 'home'
                else:
                    redirect_url = reverse_lazy('user-details', kwargs={'pk': user.id})

            login(self.request, user)
            EmailOTP.objects.filter(email=email).delete()

            return redirect(redirect_url)  # Or your home

        form.add_error('otp', 'Invalid or expired OTP')
        return self.form_invalid(form)

    def form_invalid(self, form):
        return super().form_invalid(form)


class ResendOTPView(View):
    def post(self, request, *args, **kwargs):
        email = request.POST.get('email')
        if not email or email == 'None' or email == '':
            messages.error(request, "Email is missing.")
            return redirect('login')  # or appropriate page

        # Rate limiting: no more than 3 OTPs per 5 minutes
        recent_otps = EmailOTP.objects.filter(email=email, created_at__gte=now() - timedelta(minutes=5))
        if recent_otps.count() >= 3:
            messages.error(request, "Too many OTP requests. Try again later.")
            return redirect(request.META.get('HTTP_REFERER', '/'))

        # Create new OTP
        sendOTP(email)

        messages.success(request, "A new OTP has been sent to your email.")
        return redirect('verify-otp')


class UserDetailsView(LoginRequiredMixin, UserPassesTestMixin, UpdateView):
    model = CustomUser
    fields = [
        'full_name',
        'company_name',
        'company_url',
        'company_linkedin_url',
        'user_linkedin_url',
    ]
    template_name = 'users/user_details.html'
    success_url = reverse_lazy('home')
    title = "User Details"

    def test_func(self):
        user = get_object_or_404(CustomUser, pk=self.kwargs['pk'])
        return self.request.user == user

    def handle_no_permission(self):
        if not self.request.user.is_authenticated:
            return super().handle_no_permission()
        return HttpResponseForbidden("You do not have permission to access this page.")

    def get_object(self, queryset=None):
        return self.request.user

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title
        # Ensure we always have a product_service to avoid template errors
        context["product_service"], _ = ProductService.objects.get_or_create(user=self.request.user)
        return context

    def form_valid(self, form):
        response = super().form_valid(form)

        # Save related ProductService data
        product_service, _ = ProductService.objects.get_or_create(user=self.request.user)
        product_service.service_name = self.request.POST.get('service_name')
        product_service.product_url = self.request.POST.get('product_url')
        product_service.product_usp = self.request.POST.get('product_usp')
        product_service.save()

        messages.success(self.request, "Your details have been updated successfully.")
        return response
    
class ProfileView(LoginRequiredMixin, View):
    def get(self, request):
        # Always ensure a ProductService instance exists
        product_service, _ = ProductService.objects.get_or_create(user=request.user)
        return render(request, 'users/profile.html', {
            'user': request.user,
            'product_service': product_service
        })

    def post(self, request):
        user = request.user
        product_service, _ = ProductService.objects.get_or_create(user=user)

        user.full_name = request.POST.get('full_name')
        user.company_name = request.POST.get('company_name')
        user.company_url = request.POST.get('company_url')
        user.company_linkedin_url = request.POST.get('company_linkedin_url')
        user.user_linkedin_url = request.POST.get('user_linkedin_url')

        email = request.POST.get('email')
        try:
            EmailValidator()(email)
            user.email = email
        except ValidationError:
            return render(request, 'users/profile.html', {
                'user': user,
                'product_service': product_service,
                'error': 'Invalid email format'
            })

        user.save()

        # Update ProductService data
        product_service.service_name = request.POST.get('service_name')
        product_service.product_url = request.POST.get('product_url')
        product_service.product_usp = request.POST.get('product_usp')
        product_service.save()

        return redirect('profile')