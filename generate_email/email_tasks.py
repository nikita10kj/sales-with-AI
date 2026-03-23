# from django.utils import timezone
# from django.db import transaction
# from generate_email.models import SentEmail, ReminderEmail
# from generate_email.utils import sendCampaignEmail
# from allauth.socialaccount.models import SocialAccount
# import logging
# import random
# import time

# logger = logging.getLogger(__name__)


# def send_bulk_campaign_emails():
#     now = timezone.now()

#     scheduled_emails = list(
#         SentEmail.objects.select_related("sending_account").filter(
#             is_scheduled=True,
#             scheduled_at__lte=now
#         )
#     )
#     if not scheduled_emails:
#         return

#     # check if shuffle enabled
#     shuffle_enabled = any(e.shuffle_accounts for e in scheduled_emails)
#     user = scheduled_emails[0].user

#     # get user accounts
#     accounts = list(
#         SocialAccount.objects.filter(
#             user=user,
#             provider__in=["google", "microsoft"]
#         )
#     )
#     random.shuffle(accounts)
#     account_index = 0

#     random.shuffle(scheduled_emails)
#     logger.info(f"Found {len(scheduled_emails)} scheduled emails")

#     for email_obj in scheduled_emails:
#         try:
#             # 🔹 Atomic lock to prevent double sending
#             with transaction.atomic():
#                 locked_email = SentEmail.objects.select_for_update().get(pk=email_obj.pk)
#                 if not locked_email.is_scheduled:
#                     continue
#                 locked_email.is_scheduled = False
#                 locked_email.save(update_fields=["is_scheduled"])

#             # 🔹 Account selection logic
#             if shuffle_enabled and accounts:
#                 selected_account = accounts[account_index % len(accounts)]
#                 account_index += 1
#             else:
#                 selected_account = locked_email.sending_account

#             main_email = {
#                 "subject": locked_email.subject,
#                 "body": locked_email.message
#             }

#             # attachment
#             attachment_file = None
#             if locked_email.attachment:
#                 attachment_file = locked_email.attachment.file
#                 attachment_file.open()
#                 attachment_file.seek(0)

#             # send email
#             sendCampaignEmail(
#                 request=None,
#                 user=locked_email.user,
#                 target_audience=locked_email.target_audience,
#                 main_email=main_email,
#                 selected_account=selected_account,
#                 attachment=attachment_file
#             )

#         except Exception as e:
#             logger.error(f"Email send failed: {e}")

#         finally:
#             if email_obj.attachment:
#                 email_obj.attachment.file.close()

#         time.sleep(random.randint(2, 5))


# def send_followup_emails():
#     now = timezone.now()  # use datetime instead of .date()

#     reminders = ReminderEmail.objects.select_related(
#         "sent_email",
#         "target_audience",
#         "user"
#     ).filter(
#         sent=False,
#         send_at__lte=now
#     )

#     logger.info(f"Found {reminders.count()} followup emails")

#     for r in reminders:
#         try:
#             with transaction.atomic():
#                 locked_r = ReminderEmail.objects.select_for_update().get(pk=r.pk)
#                 if locked_r.sent:
#                     continue
#                 locked_r.sent = True
#                 locked_r.save(update_fields=["sent"])

#             main_email = {
#                 "subject": locked_r.subject,
#                 "body": locked_r.message
#             }

#             sendCampaignEmail(
#                 request=None,
#                 user=locked_r.user,
#                 target_audience=locked_r.target_audience,
#                 main_email=main_email,
#                 selected_account=locked_r.sent_email.sending_account,
#                 attachment=None
#             )

#         except Exception as e:
#             logger.error(f"Followup failed: {e}")



from django.utils import timezone
from django.db import transaction
from generate_email.models import SentEmail, ReminderEmail
from generate_email.utils import (
    sendCampaignEmail,
    get_gmail_service_campaign,
    send_microsoft_email,
    create_message,
)
from allauth.socialaccount.models import SocialAccount
from email.utils import make_msgid
import logging
import random
import time

logger = logging.getLogger(__name__)


def _send_email_directly(locked_email, selected_account, attachment_file):
    """
    Actually sends the email using provider APIs.
    Does NOT create a new SentEmail — reuses the existing scheduled record.
    Updates the existing record's message_id and sending_account.
    """
    user = locked_email.user
    target_audience = locked_email.target_audience
    subject = locked_email.subject
    message = locked_email.message
    to_email = target_audience.email

    if not selected_account:
        raise Exception("No sending account selected")

    provider = selected_account.provider

    sender_email = (
        selected_account.extra_data.get("email")
        or selected_account.extra_data.get("userPrincipalName")
        or selected_account.extra_data.get("mail")
    )

    if not sender_email:
        raise Exception("Sender email not found in selected account")

    new_message_id = make_msgid(domain='sellsharp.co')

    # ── GOOGLE ──
    if provider == 'google':
        service = get_gmail_service_campaign(selected_account)
        user_name = user.full_name

        msg = create_message(
            user_name,
            sender_email,
            to_email,
            subject,
            message,
            attachment=attachment_file,
            new_msg_id=new_message_id
        )

        result = service.users().messages().send(
            userId='me',
            body=msg
        ).execute()

        # Update existing record — no new row created
        locked_email.message_id = new_message_id
        locked_email.sending_account = selected_account
        locked_email.threadId = result.get('threadId', '')
        locked_email.save(update_fields=["message_id", "sending_account", "threadId"])

    # ── MICROSOFT ──
    elif provider == 'microsoft':
        graph_id = send_microsoft_email(
            user=user,
            to_email=to_email,
            subject=subject,
            html_body=message,
            selected_account=selected_account,
            attachment=attachment_file
        )

        locked_email.message_id = graph_id
        locked_email.sending_account = selected_account
        locked_email.save(update_fields=["message_id", "sending_account"])

    else:
        raise Exception(f"Unsupported provider: {provider}")


def send_bulk_campaign_emails():
    now = timezone.now()

    scheduled_emails = list(
        SentEmail.objects.select_related("sending_account", "target_audience", "user").filter(
            is_scheduled=True,
            scheduled_at__lte=now
        )
    )

    if not scheduled_emails:
        return

    # Shuffle account logic
    shuffle_enabled = any(e.shuffle_accounts for e in scheduled_emails)
    user = scheduled_emails[0].user

    accounts = list(
        SocialAccount.objects.filter(
            user=user,
            provider__in=["google", "microsoft"]
        )
    )
    random.shuffle(accounts)
    account_index = 0

    random.shuffle(scheduled_emails)
    logger.info(f"Found {len(scheduled_emails)} scheduled emails to send")

    for email_obj in scheduled_emails:
        attachment_file = None
        try:
            # ── Atomic lock: mark as no longer scheduled ──
            with transaction.atomic():
                locked_email = SentEmail.objects.select_for_update().get(pk=email_obj.pk)
                if not locked_email.is_scheduled:
                    continue  # already sent by another worker
                locked_email.is_scheduled = False
                locked_email.save(update_fields=["is_scheduled"])

            # ── Account selection ──
            if shuffle_enabled and accounts:
                selected_account = accounts[account_index % len(accounts)]
                account_index += 1
            else:
                selected_account = locked_email.sending_account

            # ── Attachment ──
            if locked_email.attachment:
                attachment_file = locked_email.attachment.file
                attachment_file.open()
                attachment_file.seek(0)

            # ── Send WITHOUT creating a new SentEmail ──
            _send_email_directly(locked_email, selected_account, attachment_file)

            logger.info(f"Scheduled email sent to {locked_email.email} (id={locked_email.pk})")

        except Exception as e:
            logger.error(f"Scheduled email send failed (id={email_obj.pk}): {e}")
            # Roll back is_scheduled so it can be retried
            try:
                SentEmail.objects.filter(pk=email_obj.pk).update(is_scheduled=True)
            except Exception:
                pass

        finally:
            if attachment_file:
                try:
                    attachment_file.close()
                except Exception:
                    pass

        time.sleep(random.randint(2, 5))


def send_followup_emails():
    now = timezone.now()

    reminders = ReminderEmail.objects.select_related(
        "sent_email",
        "target_audience",
        "user"
    ).filter(
        sent=False,
        send_at__lte=now
    )

    logger.info(f"Found {reminders.count()} followup emails")

    for r in reminders:
        try:
            with transaction.atomic():
                locked_r = ReminderEmail.objects.select_for_update().get(pk=r.pk)
                if locked_r.sent:
                    continue
                locked_r.sent = True
                locked_r.save(update_fields=["sent"])

            main_email = {
                "subject": locked_r.subject,
                "body": locked_r.message
            }

            sendCampaignEmail(
                request=None,
                user=locked_r.user,
                target_audience=locked_r.target_audience,
                main_email=main_email,
                selected_account=locked_r.sent_email.sending_account,
                attachment=None
            )

        except Exception as e:
            logger.error(f"Followup email failed (id={r.pk}): {e}")