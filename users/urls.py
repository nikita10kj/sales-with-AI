from django.urls import path
from .views import (HomeView, LoginView, RegisterView, VerifyOTPView, ResendOTPView,
                    UserDetailsView,ProfileView,PrivacyPolicyView,TermsConditionsView)


urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('', HomeView.as_view(), name='home'),
    # path('analytics/', AnalyticsView.as_view(), name='analytics'),

    path('register/', RegisterView.as_view(), name='register'),
    path('verify/', VerifyOTPView.as_view(), name='verify-otp'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),
    path('user-details/<int:pk>/', UserDetailsView.as_view(), name='user-details'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('privacypolicy/',PrivacyPolicyView.as_view(),name='privacy-policy'),
    path('termsconditions/',TermsConditionsView.as_view(),name='terms-conditions')
]