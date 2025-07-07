# tasks.py
from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from .models import ReminderEmail, SentEmail
from saleswithai.settings import EMAIL_HOST_USER
from django.db.models import Q
from django.urls import reverse
from .utils import sendReminderEmail
from django.conf import settings
from datetime import datetime, time
import numpy as np
from users.models import CustomUser
from .models import TargetAudience


@shared_task
def send_reminders():
    today = timezone.now().date()
    if not np.is_busday(today.strftime('%Y-%m-%d')):
        return  # Exit the task, today is not a business day
    # Days at which to send reminders
    reminder_emails = ReminderEmail.objects.filter(send_at=today, sent=False)

    for er in reminder_emails:
        if not er.sent_email.stop_reminder:
            print("email",er.email)
            sendReminderEmail(er)
            er.sent = True
            er.save()


from .views import sendGeneratedEmail  # or move logic here if better

@shared_task
def send_scheduled_email(user_id, target_audience_id, main_email, request_data):
    user = CustomUser.objects.get(id=user_id)
    target = TargetAudience.objects.get(id=target_audience_id)

    class DummyRequest:
        def build_absolute_uri(self, path=''):
            return request_data['base_url'] + path  # mimic request object

    dummy_request = DummyRequest()
    sendGeneratedEmail(dummy_request, user, target, main_email)




