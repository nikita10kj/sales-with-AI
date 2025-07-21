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
import redis

@shared_task
def send_reminder_email_task(id):

    er = ReminderEmail.objects.get(id=id)
    # print("Sending email to:", er.email)
    sendReminderEmail(er)
    er.sent = True
    er.save()

redis_client = redis.StrictRedis.from_url(settings.CELERY_BROKER_URL)

@shared_task
def send_reminders():
    lock_key = "lock:send_reminders"
    lock_expiry_seconds = 900  # 15 minutes

    # Set lock key if not already set (NX = only set if not exists)
    is_locked = redis_client.set(lock_key, "1", ex=lock_expiry_seconds, nx=True)

    if not is_locked:
        print("Reminder task already running on another instance. Skipping.")
        return

    try:
        today = timezone.now().date()
        if not np.is_busday(today.strftime('%Y-%m-%d')):
            return

        reminder_emails = ReminderEmail.objects.filter(send_at=today, sent=False)

        for index, er in enumerate(reminder_emails):
            delay_seconds = index * 120
            if not er.sent and not er.sent_email.stop_reminder:
                send_reminder_email_task.apply_async(
                    args=[er.id],
                    countdown=delay_seconds
                )
    finally:
        # Optional: remove lock (or let it expire naturally)
        redis_client.delete(lock_key)

# @shared_task
# def send_reminders():
#     today = timezone.now().date()
#     if not np.is_busday(today.strftime('%Y-%m-%d')):
#         return  # Exit the task, today is not a business day
#     # Days at which to send reminders
#     reminder_emails = ReminderEmail.objects.filter(send_at=today, sent=False)
#
#     for er in reminder_emails:
#         if not er.sent_email.stop_reminder:
#             print("email",er.email)
#             sendReminderEmail(er)
#             er.sent = True
#             er.save()


from .views import sendGeneratedEmail  # or move logic here if better

# @shared_task
# def send_scheduled_email(user_id, target_audience_id, main_email, request_data):
#     user = CustomUser.objects.get(id=user_id)
#     target = TargetAudience.objects.get(id=target_audience_id)
#
#     class DummyRequest:
#         def build_absolute_uri(self, path=''):
#             return request_data['base_url'] + path  # mimic request object
#
#     dummy_request = DummyRequest()
#     sendGeneratedEmail(dummy_request, user, target, main_email)




