from django.shortcuts import render

# Create your views here.
from django.contrib.auth.decorators import login_required
from django.views.generic import FormView, View,TemplateView
from django.contrib.auth import login, authenticate
from django.contrib import messages
from .models import EmailOTP, CustomUser, ProductService, ActivityLog
from .forms import EmailForm, OTPForm
from .utils import sendOTP, add_single_sender
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
from collections import defaultdict
import re
from generate_email.models import SentEmail,TargetAudience
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q, F, FloatField, ExpressionWrapper
from django.db.models.functions import Cast
from django.core.mail import EmailMessage
from .forms import SupportForm

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
        user = self.request.user

        # Total sent emails
        total_sent = SentEmail.objects.filter(user=user).count()

        # Opened emails
        opened_count = SentEmail.objects.filter(user=user, opened=True).count()

        # Calculate open rate
        open_rate = (opened_count / total_sent * 100) if total_sent > 0 else 0

        # Get data for the last 7 days
        today = timezone.now().date()
        date_list = [today - timedelta(days=i) for i in range(6, -1, -1)]  # Last 7 days including today

        sent_data = []
        opened_data = []
        labels = []

        for date in date_list:
            start_date = datetime.combine(date, datetime.min.time())
            end_date = datetime.combine(date, datetime.max.time())
            
            sent_count = SentEmail.objects.filter(
                user=user,
                created__gte=start_date,
                created__lte=end_date
            ).count()
            
            opened_count = SentEmail.objects.filter(
                user=user,
                opened=True,
                created__gte=start_date,
                created__lte=end_date
            ).count()
            
            sent_data.append(sent_count)
            opened_data.append(opened_count)
            labels.append(date.strftime("%b %d"))

        # Get campaign types data
        campaign_types = TargetAudience.objects.filter(user=user).exclude(framework__isnull=True).exclude(framework__exact='')
        campaign_data = campaign_types.values('framework').annotate(count=Count('framework')).order_by('-count')

        # Prepare data for chart
        campaign_labels = []
        campaign_counts = []
        
        for item in campaign_data:
            campaign_labels.append(item['framework'])
            campaign_counts.append(item['count'])

        # Get top performing campaigns (by open rate)
        top_campaigns = TargetAudience.objects.filter(user=user).exclude(framework__isnull=True).exclude(framework__exact='') \
            .annotate(
                total_sent=Count('sent_email'),
                opened_count=Count('sent_email', filter=Q(sent_email__opened=True)),
                open_rate=ExpressionWrapper(
                    Cast(F('opened_count'), FloatField()) / Cast(F('total_sent'), FloatField()) * 100,
                    output_field=FloatField()
                )
            ) \
            .filter(total_sent__gt=0) \
            .order_by('-open_rate')[:3]  # Get top 3

        # Prepare top campaigns data
        top_campaigns_data = []
        for idx, campaign in enumerate(top_campaigns, start=1):
            top_campaigns_data.append({
                'rank': idx,
                'framework': campaign.framework,
                'service': campaign.selected_service or "General",
                'open_rate': round(campaign.open_rate, 1)
            })

        # Get recent activities (last 5)
        recent_activities = ActivityLog.objects.filter(user=user).order_by('-timestamp')[:5]

        context.update({
            "total_sent": total_sent,
            "open_rate": round(open_rate, 1),
            "chart_labels": labels,
            "sent_data": sent_data,
            "opened_data": opened_data,
            "campaign_labels": campaign_labels,
            "campaign_counts": campaign_counts,
            'top_campaigns': top_campaigns_data,
            'recent_activities': recent_activities,
        })

        return context


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

            user.backend = 'django.contrib.auth.backends.ModelBackend'  # or your actual backend path

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
        'contact'
    ]
    template_name = 'users/user_details.html'
    success_url = reverse_lazy('home')
    title = "User Details"

    # Helper function to prepend https:// if missing from the URL
    def normalize_url(self, url):
        if url and not url.startswith(('http://', 'https://')):
            return f'https://{url.strip()}'
        return url.strip() if url else ''

    # Override get_form to sanitize URL fields before form validation
    def get_form(self, form_class=None):
        print("→ get_form called!")  # Debug print
        form = super().get_form(form_class)

        # If the request is POST, modify the form data before validation
        if self.request.method == "POST":
            # Make the POST data mutable
            data = self.request.POST.copy()

            # Normalize each URL field and print debug info
            for field in ['company_url', 'company_linkedin_url', 'user_linkedin_url']:
                original = data.get(field)
                normalized = self.normalize_url(original)
                data[field] = normalized
                print(f"{field}: '{original}' → '{normalized}'")  # Debug print

            # Re-create the form with cleaned data
            form = form.__class__(data, instance=self.get_object(), files=self.request.FILES)

        return form

    # Restrict access: users can only edit their own profile
    def test_func(self):
        """
        Restrict access to only the owner of the profile.
        """
        user = get_object_or_404(CustomUser, pk=self.kwargs['pk'])
        return self.request.user == user

    def handle_no_permission(self):
        """
        Custom response for unauthorized access.
        """
        if not self.request.user.is_authenticated:
            return super().handle_no_permission()
        return HttpResponseForbidden("You do not have permission to access this page.")

    def get_object(self, queryset=None):
        """
        Always use the logged-in user as the object.
        """
        return self.request.user

    def get_context_data(self, **kwargs):
        """
        Add additional context like title and services to the template.
        """
        context = super().get_context_data(**kwargs)
        context["title"] = self.title
        context["services"] = ProductService.objects.filter(user=self.request.user)
        return context

    def form_valid(self, form):
        """
        Handles successful form submission, updates services, and shows a success message.
        """
        response = super().form_valid(form)
        user = self.request.user

        # Clear existing services
        ProductService.objects.filter(user=user).delete()

        # Collect new services using regex and defaultdict
        services_data = defaultdict(dict)
        service_pattern = re.compile(r'service_name_(\d+)')

        for key, value in self.request.POST.items():
            match = service_pattern.match(key)
            if match:
                idx = match.group(1)
                services_data[idx]['service_name'] = value.strip()
                services_data[idx]['product_url'] = self.normalize_url(self.request.POST.get(f'product_url_{idx}', ''))
                services_data[idx]['product_usp'] = self.request.POST.get(f'product_usp_{idx}', '').strip()

        # Save valid services
        for service in services_data.values():
            if service.get('service_name') and service.get('product_url'):
                ProductService.objects.create(
                    user=user,
                    service_name=service['service_name'],
                    product_url=service['product_url'],
                    product_usp=service.get('product_usp', '')
                )

        # Optional custom action and user feedback
        add_single_sender(user)
        messages.success(self.request, "Your details and services have been updated successfully.")

        return response
    
class ProfileView(LoginRequiredMixin, View):

    def normalize_url(self, url):
        """Prepends https:// if the URL does not start with http:// or https://"""
        if url and not url.startswith(('http://', 'https://')):
            return f'https://{url.strip()}'
        return url.strip() if url else ''

    def get(self, request):
        # Fetch services for the logged-in user
        services = ProductService.objects.filter(user=request.user).order_by('id')
        return render(request, 'users/profile.html', {
            'user': request.user,
            'services': services,
        })

    def post(self, request):
        user = request.user
        errors = {}
        changes = {}

        # Validate and update email
        email = request.POST.get('email', '').strip()
        try:
            EmailValidator()(email)
            if user.email != email:
                changes['email'] = {'old': user.email, 'new': email}
            user.email = email
        except ValidationError:
            errors['email'] = 'Invalid email format'

        # Collect and normalize user fields
        full_name = request.POST.get('full_name', '').strip()

        if user.full_name != full_name:
            changes['full_name'] = {'old': user.full_name, 'new': full_name}
        user.full_name = full_name
        contact = request.POST.get('contact', '').strip()
        if user.contact != contact:
            changes['contact'] = {'old': user.contact, 'new': contact}
        user.contact = contact
        company_name = request.POST.get('company_name', '').strip()
        if user.company_name != company_name:
            changes['company_name'] = {'old': user.company_name, 'new': company_name}
        user.company_name = company_name
        company_url = self.normalize_url(request.POST.get('company_url', ''))
        if user.company_url != company_url:
            changes['company_url'] = {'old': user.company_url, 'new': company_url}
        user.company_url = company_url
        company_linkedin_url = self.normalize_url(request.POST.get('company_linkedin_url', ''))
        if user.company_linkedin_url != company_linkedin_url:
            changes['company_linkedin_url'] = {
                'old': user.company_linkedin_url,
                'new': company_linkedin_url
            }
        user.company_linkedin_url = company_linkedin_url
        user_linkedin_url = self.normalize_url(request.POST.get('user_linkedin_url', ''))
        if user.user_linkedin_url != user_linkedin_url:
            changes['user_linkedin_url'] = {
                'old': user.user_linkedin_url,
                'new': user_linkedin_url
            }
        user.user_linkedin_url = user_linkedin_url

        # If any validation error occurred, re-render form with data and errors
        if errors:
            services = ProductService.objects.filter(user=user)
            return render(request, 'users/profile.html', {
                'user': user,
                'services': services,
                'errors': errors
            })

        # Save updated user data
        user.save()
        if changes:
            field_labels = {
                'email': 'Email',
                'full_name': 'Full Name',
                'contact': 'Contact Number',
                'company_name': 'Company Name',
                'company_url': 'Company Website',
                'company_linkedin_url': 'Company LinkedIn',
                'user_linkedin_url': 'Your LinkedIn',
            }

            # Join changed fields into a sentence
            changed_fields = [field_labels.get(field, field) for field in changes.keys()]
            readable_fields = ' and '.join(
                [', '.join(changed_fields[:-1]), changed_fields[-1]] if len(changed_fields) > 1 else changed_fields)

            description = f"You updated your {readable_fields}"

            ActivityLog.objects.get_or_create(
                user=user,
                action="PROFILE_UPDATED",
                description=description
            )

        # Delete previous services
        ProductService.objects.filter(user=user).delete()

        # # Add new services from form
        # index = 0
        # while True:
        #     name = request.POST.get(f'service_name_{index}')
        #     url = request.POST.get(f'product_url_{index}')
        #     usp = request.POST.get(f'product_usp_{index}')

        #     # Stop loop if all fields are empty
        #     if not name and not url and not usp:
        #         break

        #     # Save only if name and URL are provided
        #     if name and url:
        #         normalized_url = self.normalize_url(url)
        #         ProductService.objects.create(
        #             user=user,
        #             service_name=name.strip(),
        #             product_url=normalized_url,
        #             product_usp=usp.strip() if usp else ''
        #         )

        #     index += 1

        # return redirect('profile')

        # Group service fields by index using defaultdict
        services_data = defaultdict(dict)
        service_name_pattern = re.compile(r'service_name_(\d+)')
        for key, value in request.POST.items():
            match = service_name_pattern.match(key)
            if match:
                idx = match.group(1)
                services_data[idx]['service_name'] = value.strip()
                services_data[idx]['product_url'] = self.normalize_url(request.POST.get(f'product_url_{idx}', ''))
                services_data[idx]['product_usp'] = request.POST.get(f'product_usp_{idx}', '').strip()

        # Create new ProductService entries
        for service in services_data.values():
            name = service.get('service_name')
            url = service.get('product_url')
            if name and url:
                ProductService.objects.create(
                    user=user,
                    service_name=name,
                    product_url=url,
                    product_usp=service.get('product_usp', '')
                )

        messages.success(request, "Your profile has been updated successfully!")

        return redirect('profile')
    
class PrivacyPolicyView(View):
    template_name='users/privacypolicy.html'

    def get(self, request):
        return render(request, self.template_name)
    
class TermsConditionsView(View):
    template_name='users/termsconditions.html'

    def get(self, request):
        return render(request, self.template_name)

# class SupportView(LoginRequiredMixin, View):
#     def get(self, request):
#         return render(request, 'users/support.html', {'user': request.user})

#     def post(self, request):
#         subject = request.POST.get('subject', '').strip()
#         message = request.POST.get('message', '').strip()

#         user = request.user
#         user_email = user.email

#         if subject and message:
#             # Save request without needing email field in the model
#             SupportRequest.objects.create(
#                 user=user,
#                 subject=subject,
#                 message=message
#             )

#             # Email body and sending
#             full_message = f"Support request from {user.get_full_name()} ({user_email}):\n\n{message}"
#             try:
#                 email_msg = EmailMessage(
#                     subject=f"[Support] {subject}",
#                     body=full_message,
#                     from_email=settings.DEFAULT_FROM_EMAIL,
#                     to=['jmsadvisory1@gmail.com'],
#                     headers={'Reply-To': user_email}  # ✅ Reply goes to user
#                 )
#                 email_msg.send(fail_silently=False)

#                 messages.success(request, "Support request submitted and emailed successfully.")
#             except Exception as e:
#                 messages.error(request, f"Failed to send email: {e}")

#             return redirect('support')

#         else:
#             messages.error(request, "Please fill out all fields.")
#             return render(request, 'users/support.html', {
#                 'user': user,
#                 'subject': subject,
#                 'message': message
#           })

class SupportView(LoginRequiredMixin, FormView):    
    template_name = "users/support.html"    
    form_class = SupportForm    
    def get_context_data(self, **kwargs):        
        context = super().get_context_data(**kwargs)        
        return context    
    
    def form_valid(self, form):        
        email = form.cleaned_data["email"]        
        subject = form.cleaned_data["subject"]        
        message = form.cleaned_data["message"]        
        email_msg = EmailMessage(            
            subject=f"[Support] {subject}",            
            body=message,            
            to=["jmsadvisory1@gmail.com"],            
            reply_to=[email],        
            )        
        email_msg.send(fail_silently=False)        
        messages.success(self.request, "We have received your message!")        
        return redirect('support')    
    
    def form_invalid(self, form):        
        messages.error(self.request, "There was a problem with your submission.")        
        return self.render_to_response(self.get_context_data(form=form))