from django.urls import path
from .views import (GenerateEmailView, SendEmailView, EmailListView,EmailMessageView,
                    LeadListView, LeadEmailListView, email_open_pixel, export_target_audience_csv, msgraph_webhook, CheckEmailHistoryView)

urlpatterns = [
    path("generate_email/", GenerateEmailView.as_view(), name="generate_email"),
    path("send_email/", SendEmailView.as_view(), name="send_email"),
    path('emails/', EmailListView.as_view(), name='view-emails'),
    path('leads/', LeadListView.as_view(), name='view-leads'),
    path('leads_email/<int:pk>', LeadEmailListView.as_view(), name='view-leads-email'),
    path('export-leads/', export_target_audience_csv, name='export-leads'),
    path('webhook/msgraph/', msgraph_webhook, name='msggraph_webhook'),
    path('emailmessage/<uuid:uid>/', EmailMessageView.as_view(), name='view-email-message'),
    path('check-email-history/',CheckEmailHistoryView.as_view(),name="check_email_history"),
    path("email/open/<uuid:uid>/", email_open_pixel, name="email_open_pixel"),
]