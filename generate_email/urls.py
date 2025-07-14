from django.urls import path
from .views import (GenerateEmailView, SendEmailView, EmailListView,EmailMessageView,track_email_open,
                    LeadListView, LeadEmailListView, export_target_audience_csv)

urlpatterns = [
    path("generate_email/", GenerateEmailView.as_view(), name="generate_email"),
    path("send_email/", SendEmailView.as_view(), name="send_email"),
    path('track-email/<uuid:uid>/', track_email_open, name='track-email-open'),
    path('emails/', EmailListView.as_view(), name='view-emails'),
    path('leads/', LeadListView.as_view(), name='view-leads'),
    path('leads_email/<int:pk>', LeadEmailListView.as_view(), name='view-leads-email'),
    path('export-leads/', export_target_audience_csv, name='export-leads'),

    path('emailmessage/<uuid:uid>/', EmailMessageView.as_view(), name='view-email-message'),
]