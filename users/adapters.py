from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.urls import reverse
from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.exceptions import ImmediateHttpResponse
from django.contrib.auth import get_user_model

User = get_user_model()

class MySocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        # If already logged in, nothing to do
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f"User: {request.user}, Authenticated: {request.user.is_authenticated}")
        if request.user.is_authenticated:
            return

        email = sociallogin.user.email
        if not email:
            return

        try:
            existing_user = User.objects.get(email=email)
        except User.DoesNotExist:
            return  # No existing user, proceed with normal signup flow

        # If user exists but doesn't have this social account, link it
        sociallogin.connect(request, existing_user)

        # Optional: stop further processing
        # raise ImmediateHttpResponse(self.respond_social_login_redirect(request, sociallogin))

    def is_auto_signup_allowed(self, request, sociallogin):
        # Allow auto-signup to skip the intermediate page
        return True

class CustomSocialAccountAdapter(DefaultAccountAdapter):

    def get_login_redirect_url(self, request):
        print('login')
        return reverse('home')  # user already existed

    def get_signup_redirect_url(self, request):
        print('signup')
        user_id = request.user.id
        return reverse('user-details', kwargs={'pk': user_id}) # first-time social login


