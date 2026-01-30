from django.urls import path
from .views import ( HomeView, LoginView,LandingPageView, RegisterView, VerifyOTPView, ResendOTPView,
                    UserDetailsView,ProfileView,PrivacyPolicyView,TermsConditionsView,SupportView,LearningHubView, dashboard, remove_google_account, AdminDashboardView)


urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('', HomeView.as_view(), name='home'),
    path('register/', RegisterView.as_view(), name='register'),
    path('verify/', VerifyOTPView.as_view(), name='verify-otp'),
    path('resend-otp/', ResendOTPView.as_view(), name='resend_otp'),
    path('user-details/<int:pk>/', UserDetailsView.as_view(), name='user-details'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('privacypolicy/',PrivacyPolicyView.as_view(),name='privacy-policy'),
    path('learninghub/',LearningHubView.as_view(),name='learning-hub'),
    path('termsconditions/',TermsConditionsView.as_view(),name='terms-conditions'),
    path('support/', SupportView.as_view(), name='support'),
    path("dashboard/", dashboard, name="dashboard"),
    path("remove-google/<int:pk>/",remove_google_account, name="remove_google_account"),
    path("admin-dashboard/", AdminDashboardView.as_view(), name="admin-dashboard"),
]