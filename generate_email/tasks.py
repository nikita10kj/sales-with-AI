# tasks.py
# from celery import shared_task
# from django.utils import timezone
# from datetime import timedelta
# from django.core.mail import send_mail
from .models import ReminderEmail, SentEmail, EmailSubscription
from saleswithai.settings import EMAIL_HOST_USER
# from django.db.models import Q
# from django.urls import reverse
from .utils import sendReminderEmail, create_subscription
# from django.conf import settings
# from datetime import datetime, time
# import numpy as np
from users.models import CustomUser
# from .models import TargetAudience
# import redis

import os
import django
import numpy as np
from django.utils import timezone
from datetime import timedelta
import time
# Setup Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "saleswithai.settings")
django.setup()

# def send_reminder_email(er):
#     print("Sending email to:", er.email)
#     sendReminderEmail(er)
#     er.sent = True
#     er.save()

def send_reminder_email(er):
    from django.db import transaction
    
    with transaction.atomic():
        # Lock the row
        locked = ReminderEmail.objects.select_for_update().get(pk=er.pk)
        if locked.sent:
            print(f"Already sent, skipping: {locked.email}")
            return
        locked.sent = True
        locked.save(update_fields=["sent"])

    print(f"Sending follow-up to: {locked.email}")
    try:
        sendReminderEmail(locked)
    except Exception as e:
        # Roll back so it retries tomorrow
        ReminderEmail.objects.filter(pk=er.pk).update(sent=False)
        print(f"Failed to send to {locked.email}: {e}")
        raise

# def send_reminder_email(er):
#     print("🚀 START sending reminder:", er.id, er.email)

#     try:
#         sendReminderEmail(er)

#         er.sent = True
#         er.save(update_fields=["sent"])

#         print(f"✅ SUCCESS: Reminder sent to {er.email}")

#     except Exception as e:
#         print(f"❌ FAILED: Reminder (id={er.id}) error: {e}")
#         import traceback
#         traceback.print_exc()

# ------------------fix1--------------------

def send_reminders():
    today = timezone.now().date()
    tomorrow = today + timedelta(days=1)

    if not np.is_busday(today.strftime('%Y-%m-%d')):
        print("Not a business day. Exiting.")
        return

    reminders = ReminderEmail.objects.filter(
        send_at__date=today,
        sent=False
    ).select_related("sent_email", "user")

    print(f"Found {reminders.count()} follow-ups for today")

    for er in reminders:
        # Refresh to avoid race condition
        er.refresh_from_db()
        if er.sent:
            continue

        if er.sent_email.stop_reminder:
            continue

        # Refresh Microsoft subscription
        for sub in EmailSubscription.objects.filter(user=er.user):
            if sub.expires_at <= timezone.now() + timedelta(days=1):
                create_subscription(er.user)

        send_reminder_email(er)
        time.sleep(90) # 90s gap between each send

# def send_reminders():
#     today = timezone.now().date()

#     # Only send if it's a business day
#     if not np.is_busday(today.strftime('%Y-%m-%d')):
#         print("Not a business day. Exiting.")
#         return

#     reminders = ReminderEmail.objects.filter(send_at=today, sent=False)

#     for er in reminders:
#         if EmailSubscription.objects.filter(user=er.user).exists():
#             for sub in EmailSubscription.objects.filter(user=er.user):
#                 if sub.expires_at <= timezone.now() + timedelta(days=1):
#                     create_subscription(er.user)
#         if not er.sent and not er.sent_email.stop_reminder:

#             send_reminder_email(er)
#             time.sleep(90)

# if __name__ == "__main__":
#     send_reminders()

# @shared_task
# def send_reminder_email_task(id):
#
#     er = ReminderEmail.objects.get(id=id)
#     print("Sending email to:", er.email)
#     sendReminderEmail(er)
#     er.sent = True
#     er.save()
#
# redis_client = redis.StrictRedis.from_url(settings.CELERY_BROKER_URL)
#
# @shared_task
# def send_reminders():
#     lock_key = "lock:send_reminders"
#     lock_expiry_seconds = 900  # 15 minutes
#
#     # Set lock key if not already set (NX = only set if not exists)
#     is_locked = redis_client.set(lock_key, "1", ex=lock_expiry_seconds, nx=True)
#
#     if not is_locked:
#         print("Reminder task already running on another instance. Skipping.")
#         return
#
#     try:
#         today = timezone.now().date()
#         if not np.is_busday(today.strftime('%Y-%m-%d')):
#             return
#
#         reminder_emails = ReminderEmail.objects.filter(send_at=today, sent=False)
#
#         for index, er in enumerate(reminder_emails):
#             delay_seconds = index * 120
#             if not er.sent and not er.sent_email.stop_reminder:
#                 send_reminder_email_task.apply_async(
#                     args=[er.id],
#                     countdown=delay_seconds
#                 )
#     finally:
#         # Optional: remove lock (or let it expire naturally)
#         redis_client.delete(lock_key)

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


# from .views import sendGeneratedEmail  # or move logic here if better

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

from django.conf import settings
from .utils import get_message_details, get_conversation_id

def process_msgraph_change(change):
    """Process a single MS Graph webhook change in background thread."""

    if change.get("clientState") != settings.MS_GRAPH_CLIENT_STATE:
        return

    msg_id = change.get("resourceData", {}).get("id")
    sub_id = change.get("subscriptionId")

    if not msg_id or not sub_id:
        return

    try:
        sub = EmailSubscription.objects.get(subscription_id=sub_id)
        user = sub.user
    except EmailSubscription.DoesNotExist:
        return

    try:
        message_data = get_message_details(user, msg_id)
    except Exception as e:
        print(f"Graph API error while getting message details: {e}")
        return

    if not message_data or not isinstance(message_data, dict):
        print("MS Graph webhook returned invalid message data")
        return

    value_list = message_data.get("value", [])
    if not value_list:
        return

    in_reply_to = value_list[0].get("conversationId")
    if not in_reply_to:
        return

    emails = SentEmail.objects.filter(
        user=user,
        reminder_email__isnull=False
    ).distinct()

    stop_ids = []
    for email in emails:
        sent_msg_id = email.message_id
        if not sent_msg_id or not sent_msg_id.startswith("AA"):
            continue
        try:
            from .utils import get_conversation_id
            conversation_id = get_conversation_id(user, sent_msg_id)
        except Exception as e:
            print(f"Graph API error: {e}")
            continue

        if conversation_id == in_reply_to:
            stop_ids.append(email.id)

    # Bulk update — one DB query instead of one per email
    if stop_ids:
        SentEmail.objects.filter(id__in=stop_ids).update(stop_reminder=True)
        print(f"Stopped reminders for {len(stop_ids)} emails")




# import threading

# _tasks = {}
# _tasks_lock = threading.Lock()

# def set_task(task_id, data):
#     with _tasks_lock:
#         _tasks[task_id] = data

# def get_task(task_id):
#     with _tasks_lock:
#         return _tasks.get(task_id)

# def update_task(task_id, **kwargs):
#     with _tasks_lock:
#         if task_id in _tasks:
#             _tasks[task_id].update(kwargs)



# tasks.py
from .models import TaskResult

def set_task(task_id, data):
    TaskResult.objects.create(
        task_id  = task_id,
        status = data.get("status", "pending"),
        progress = data.get("progress", 0),
        total = data.get("total", 0),
        framework = data.get("framework", ""),
        result = data.get("result"),
        contact_names = data.get("contact_names", []),
        error = data.get("error", "") or "",
    )

def get_task(task_id):
    try:
        t = TaskResult.objects.get(task_id=task_id)
        return {
            "status":        t.status,
            "progress":      t.progress,
            "total":         t.total,
            "framework":     t.framework,
            "result":        t.result,
            "contact_names": t.contact_names,
            "error":         t.error,
        }
    except TaskResult.DoesNotExist:
        return None

def update_task(task_id, **kwargs):
    TaskResult.objects.filter(task_id=task_id).update(**kwargs)




