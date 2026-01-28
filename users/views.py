from django.contrib.auth.decorators import login_required
from django.views.generic import FormView, View,TemplateView
from django.contrib.auth import login, authenticate
from django.contrib import messages
from .models import EmailOTP, CustomUser, ProductService, ActivityLog,Signature
from .forms import EmailForm, OTPForm,SupportForm
from .utils import sendOTP, add_single_sender
from django.contrib.auth.views import PasswordResetView
from django.utils.timezone import now
from datetime import timedelta
from django.contrib.auth.mixins import LoginRequiredMixin,UserPassesTestMixin
from django.views.generic.edit import UpdateView
from django.urls import reverse_lazy
import os, json,re
from django.conf import settings
from django.shortcuts import redirect, get_object_or_404
from django.views.decorators.csrf import requires_csrf_token
from django.http import HttpResponseForbidden
from django.core.validators import URLValidator, EmailValidator
from django.core.exceptions import ValidationError
from collections import defaultdict
from generate_email.models import SentEmail,TargetAudience
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q, F, FloatField, ExpressionWrapper
from django.db.models.functions import Cast
from django.core.mail import EmailMessage
from generate_email.models import EmailSubscription
from generate_email.utils import create_subscription
from allauth.socialaccount.models import SocialAccount
from django.views import View
from django.shortcuts import render, redirect
from django.contrib import messages
from django.http import JsonResponse


@requires_csrf_token
def csrf_failure(request, reason=""):
    # Redirect to login page with error message
    messages.error(request, "Invalid session. Please log in again.")
    return redirect('login')

class LandingPageView(TemplateView):
    template_name = 'users/landingpage.html'
    title = "SellSharp"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title
        return context


class HomeView(LoginRequiredMixin, TemplateView):
    template_name = 'users/dashboard.html'
    title = "Home"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["title"] = self.title
        user = self.request.user
        all_users = None

        # --- Subscription validation ---
        if EmailSubscription.objects.filter(user=user).exists():
            for sub in EmailSubscription.objects.filter(user=user):
                if sub.expires_at and sub.expires_at <= timezone.now():
                    create_subscription(user)
        else:
            create_subscription(user)

        # --- Email sending limit logic ---
        organization_domain = "jmsadvisory"
        user_email = (user.email or "").lower()
        email_limit = None
        remaining_emails = None

        # Only apply the 500-email limit to external users
        if organization_domain not in user_email:
            total_sent_user = SentEmail.objects.filter(user=user).count()
            email_limit = 500
            remaining_emails = max(email_limit - total_sent_user, 0)
        else:
            total_sent_user = SentEmail.objects.filter(user=user).count()

        # Total sent emails
        if user.is_superuser:
            sent_emails = SentEmail.objects.all()
            campaign_types = TargetAudience.objects.all().exclude(framework__isnull=True).exclude(
                framework__exact='')
            recent_activities = ActivityLog.objects.all().order_by('-timestamp')[:5]

            today = now().date()

            all_users = CustomUser.objects.annotate(
                total_sent=Count('sent_email'),
                opened_count=Count('sent_email', filter=Q(sent_email__opened=True)),
                today_sent=Count(
                    'sent_email',
                    filter=Q(sent_email__created__date=today)
                ),
                today_opened=Count(
                    'sent_email',
                    filter=Q(sent_email__created__date=today, sent_email__opened=True)
                ),
            )
            

        else:
            sent_emails = SentEmail.objects.filter(user=user)
            # total_sent = SentEmail.objects.filter(user=user).count()
            # opened_count = SentEmail.objects.filter(user=user, opened=True).count()
            campaign_types = TargetAudience.objects.filter(user=user).exclude(framework__isnull=True).exclude(
                framework__exact='')
            recent_activities = ActivityLog.objects.filter(user=user).order_by('-timestamp')[:5]

        # Calculate open rate
        total_sent=sent_emails.count()
        total_opened_emails = sent_emails.filter(opened=True).count()

        read_emails = total_opened_emails
        unread_emails = total_sent - total_opened_emails

        open_rate = (total_opened_emails / total_sent * 100) if total_sent > 0 else 0

        read_percentage = open_rate
        unread_percentage = 100 - open_rate if total_sent > 0 else 0

        # Get data for the last 7 days
        today = timezone.now().date()
        this_month_start = today.replace(day=1)
        yesterday = today - timedelta(days=1)

        today_sent = sent_emails.filter(
            created__date=today
        ).count()
        yesterday_sent = sent_emails.filter(created__date=yesterday).count()

        this_week_start = today - timedelta(days=today.weekday())  # Monday
        this_week_end = this_week_start + timedelta(days=6)

        last_week_start = this_week_start - timedelta(days=7)
        last_week_end = this_week_start - timedelta(days=1)

        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        # Counts
        this_week_sent = sent_emails.filter(
            created__date__gte=this_week_start,
            created__date__lte=this_week_end
        ).count()

        last_week_sent = sent_emails.filter(
            created__date__gte=last_week_start,
            created__date__lte=last_week_end
        ).count()

        this_month_sent = sent_emails.filter(
            created__date__gte=this_month_start
        ).count()

        last_month_sent = sent_emails.filter(
            created__date__gte=last_month_start,
            created__date__lte=last_month_end
        ).count()


        date_list = [today - timedelta(days=i) for i in range(6, -1, -1)]  # Last 7 days including today

        sent_data = []
        opened_data = []
        labels = []

        for date in date_list:
            start_date = datetime.combine(date, datetime.min.time())
            end_date = datetime.combine(date, datetime.max.time())
            
            sent_count = sent_emails.filter(
                created__gte=start_date,
                created__lte=end_date
            ).count()
            
            opened_count_day = sent_emails.filter(
                opened=True,
                created__gte=start_date,
                created__lte=end_date
            ).count()
            
            # sent_data.append(sent_count)
            sent_data.append(
                sent_emails.filter(created__range=(start_date, end_date)).count()
    )
            # opened_data.append(opened_count_day)
            opened_data.append(
                sent_emails.filter(
                opened=True,
                created__range=(start_date, end_date)
        ).count()
            )

            today_opened = sent_emails.filter(
            opened=True,
            opened_at__date=today
        ).count()
            labels.append(date.strftime("%b %d"))

        # Get campaign types data
        campaign_data = campaign_types.values('framework').annotate(count=Count('framework')).order_by('-count')

        # Prepare data for chart
        campaign_labels = []
        campaign_counts = []
        
        for item in campaign_data:
            campaign_labels.append(item['framework'])
            campaign_counts.append(item['count'])

        # Get top performing campaigns (by open rate)
        top_campaigns = campaign_types \
            .annotate(
                total_sent=Count('sent_email'),
                opened_count=Count('sent_email', filter=Q(sent_email__opened=True)),
                open_rate=ExpressionWrapper(
                    Cast(F('opened_count'), FloatField()) / Cast(F('total_sent'), FloatField()) * 100,
                    output_field=FloatField()
                )
            ) \
            .filter(total_sent__gt=0) \
            .order_by('-open_rate')[:4]  # Get top 4

        # Prepare top campaigns data
        top_campaigns_data = []
        for idx, campaign in enumerate(top_campaigns, start=1):
            top_campaigns_data.append({
                'rank': idx,
                'framework': campaign.framework,
                'service': campaign.selected_service or "General",
                'open_rate': round(campaign.open_rate, 1)
            })


        context.update({
            "total_sent": total_sent,
            "today_sent": today_sent,
            "yesterday_sent": yesterday_sent,
            "this_week_sent": this_week_sent,
            "last_week_sent": last_week_sent,
            "this_month_sent": this_month_sent,
            "last_month_sent": last_month_sent,
            "open_rate": round(open_rate, 1),
            "today_opened": today_opened,
            "read_emails": read_emails,
            "unread_emails": unread_emails,
            "read_percentage": round(read_percentage, 1),
            "unread_percentage": round(unread_percentage, 1),
            "chart_labels": labels,
            "sent_data": sent_data,
            "opened_data": opened_data,
            "campaign_labels": campaign_labels,
            "campaign_counts": campaign_counts,
            'top_campaigns': top_campaigns_data,
            'recent_activities': recent_activities,
            'all_users': all_users,
            'sent_emails': sent_emails,
            'email_limit': email_limit,
            'remaining_emails': remaining_emails,
            'total_sent_user': total_sent_user,
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
        if url and not url.startswith(('http://', 'https://')):
            return f'https://{url.strip()}'
        return url.strip() if url else ''

    def get(self, request):
        google_accounts = SocialAccount.objects.filter(
            user=request.user,
            provider="google"
        )

        services = ProductService.objects.filter(
            user=request.user
        ).order_by('id')

        signatures = Signature.objects.filter(
        user=request.user
        ).order_by('id')

        return render(request, 'users/profile.html', {
            'user': request.user,
            'services': services,
            "signatures": signatures,
            "google_accounts": google_accounts

        })

    
    def post(self, request):
        user = request.user
        if 'personal_submit' in request.POST:

            errors = {}
            changes = {}

            # Email
            email = request.POST.get('email', '').strip()
            try:
                EmailValidator()(email)
                if user.email != email:
                    if CustomUser.objects.exclude(id=user.id).filter(email=email).exists():
                        errors['email'] = "Email already exists"
                    changes['email'] = {'old': user.email, 'new': email}
                user.email = email
            except ValidationError:
                errors['email'] = 'Invalid email format'

            # Full Name
            full_name = request.POST.get('full_name', '').strip()
            if user.full_name != full_name:
                changes['full_name'] = {'old': user.full_name, 'new': full_name}
            user.full_name = full_name

            # Contact
            contact = request.POST.get('contact', '').strip()
            if user.contact != contact:
                changes['contact'] = {'old': user.contact, 'new': contact}
            user.contact = contact

            # Company Name
            company_name = request.POST.get('company_name', '').strip()
            if user.company_name != company_name:
                changes['company_name'] = {'old': user.company_name, 'new': company_name}
            user.company_name = company_name

            # Company URL
            company_url = self.normalize_url(request.POST.get('company_url', ''))
            if user.company_url != company_url:
                changes['company_url'] = {'old': user.company_url, 'new': company_url}
            user.company_url = company_url

            # Company LinkedIn
            company_linkedin_url = self.normalize_url(
                request.POST.get('company_linkedin_url', '')
            )
            if user.company_linkedin_url != company_linkedin_url:
                changes['company_linkedin_url'] = {
                    'old': user.company_linkedin_url,
                    'new': company_linkedin_url
                }
            user.company_linkedin_url = company_linkedin_url

            # User LinkedIn
            user_linkedin_url = self.normalize_url(
                request.POST.get('user_linkedin_url', '')
            )
            if user.user_linkedin_url != user_linkedin_url:
                changes['user_linkedin_url'] = {
                    'old': user.user_linkedin_url,
                    'new': user_linkedin_url
                }
            user.user_linkedin_url = user_linkedin_url

            # Errors → return page
            if errors:
                services = ProductService.objects.filter(user=user)
                return render(request, 'users/profile.html', {
                    'user': user,
                    'services': services,
                    'errors': errors
                })

            user.save()

            if changes:
                ActivityLog.objects.get_or_create(
                    user=user,
                    action="PROFILE_UPDATED",
                    description="Profile updated"
                )

            messages.success(request, "Personal information updated successfully!")
            return redirect('profile')

        
        elif 'knowledge_submit' in request.POST:
            ProductService.objects.filter(user=user).delete()
            services_data = defaultdict(dict)
            pattern = re.compile(r'service_name_(\d+)')

            for key, value in request.POST.items():
                match = pattern.match(key)
                if match:
                    idx = match.group(1)
                    services_data[idx]['service_name'] = value.strip()
                    services_data[idx]['product_url'] = self.normalize_url(
                        request.POST.get(f'product_url_{idx}', '')
                    )
                    services_data[idx]['product_usp'] = request.POST.get(
                        f'product_usp_{idx}', ''
                    ).strip()

            for service in services_data.values():
                if service.get('service_name') and service.get('product_url'):
                    ProductService.objects.create(
                        user=user,
                        service_name=service['service_name'],
                        product_url=service['product_url'],
                        product_usp=service.get('product_usp', '')
                    )

            messages.success(request, "Knowledge Base saved successfully!")
            return redirect('profile')
        
        elif 'signature_submit' in request.POST:
            Signature.objects.filter(user=user).delete()

            for key, value in request.POST.items():
                if key.startswith('signature_') and value.strip():
                    idx = key.split('_')[1]
                    photo = request.FILES.get(f'signature_photo_{idx}')

                    Signature.objects.create(
                            user=user,
                            signature=value.strip(),
                            photo=photo
                    )
            
            messages.success(request, "Signatures saved successfully!")
            return redirect('profile')

        return redirect('profile')
        
class PrivacyPolicyView(View):
    template_name='users/privacypolicy.html'

    def get(self, request):
        return render(request, self.template_name)

class LearningHubView(View):
    template_name='users/learninghub.html'

    def get(self, request):
        return render(request, self.template_name)
class TermsConditionsView(View):
    template_name='users/termsconditions.html'

    def get(self, request):
        return render(request, self.template_name)

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

@login_required
def thirdparty_redirect(request):
    """
    Override allauth 3rdparty page
    Always redirect to profile
    """
    return redirect('login')

@login_required
def dashboard(request):
    user = request.user

    total_emails = SentEmail.objects.filter(user=user).count()
    opened_emails = SentEmail.objects.filter(user=user, opened=True).count()
    unread_emails = SentEmail.objects.filter(user=user, opened=False).count()

    open_rate = 0
    if total_emails > 0:
        open_rate = round((opened_emails / total_emails) * 100, 2)

    context = {
        "total_emails": total_emails,
        "opened_emails": opened_emails,
        "unread_emails": unread_emails,
        "open_rate": open_rate,
    }

    return render(request, "users/dashboard.html", context)