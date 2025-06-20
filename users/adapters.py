from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from django.urls import reverse
from allauth.account.adapter import DefaultAccountAdapter


class CustomSocialAccountAdapter(DefaultAccountAdapter):

    def get_login_redirect_url(self, request):
        print('login')
        return reverse('home')  # user already existed

    def get_signup_redirect_url(self, request):
        print('signup')
        user_id = request.user.id
        return reverse('user-details', kwargs={'pk': user_id}) # first-time social login


