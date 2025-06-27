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


@shared_task
def send_reminders():
    today = timezone.now().date()
    if not np.is_busday(today.strftime('%Y-%m-%d')):
        return  # Exit the task, today is not a business day
    # Days at which to send reminders
    reminder_emails = ReminderEmail.objects.filter(send_at=today, sent=False)

    for er in reminder_emails:
        print("email", er.email, er.user.email)
        if not er.sent_email.stop_reminder:
            sendReminderEmail(er)
            er.sent = True
            print("sent")
            er.save()





