from django.urls import path
from .views import (GenerateEmailView, SendEmailView, EmailListView,EmailMessageView,track_email_open)

urlpatterns = [
    path("generate_email/", GenerateEmailView.as_view(), name="generate_email"),
    path("send_email/", SendEmailView.as_view(), name="send_email"),
    path('track-email/<uuid:uid>/', track_email_open, name='track-email-open'),
    path('emails/', EmailListView.as_view(), name='view-emails'),
    path('emailmessage/<uuid:uid>/', EmailMessageView.as_view(), name='view-email-message'),
]