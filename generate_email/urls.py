from django.urls import path
from .views import (GenerateEmailView, SendEmailView, track_email_open)

urlpatterns = [
    path("generate_email/", GenerateEmailView.as_view(), name="generate_email"),
    path("send_email/", SendEmailView.as_view(), name="send_email"),
    path('track-email/<uuid:uid>/', track_email_open, name='track-email-open'),

]