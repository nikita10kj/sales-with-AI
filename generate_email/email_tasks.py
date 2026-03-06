from django.utils import timezone
from django.db import transaction
from generate_email.models import SentEmail, ReminderEmail
from generate_email.utils import sendCampaignEmail
from allauth.socialaccount.models import SocialAccount
import logging
import random
import time

logger = logging.getLogger(__name__)


def send_bulk_campaign_emails():
    now = timezone.now()

    scheduled_emails = list(
        SentEmail.objects.select_related("sending_account").filter(
            is_scheduled=True,
            scheduled_at__lte=now
        )
    )
    if not scheduled_emails:
        return

    # check if shuffle enabled
    shuffle_enabled = any(e.shuffle_accounts for e in scheduled_emails)
    user = scheduled_emails[0].user

    # get user accounts
    accounts = list(
        SocialAccount.objects.filter(
            user=user,
            provider__in=["google", "microsoft"]
        )
    )
    random.shuffle(accounts)
    account_index = 0

    random.shuffle(scheduled_emails)
    logger.info(f"Found {len(scheduled_emails)} scheduled emails")

    for email_obj in scheduled_emails:
        try:
            # 🔹 Atomic lock to prevent double sending
            with transaction.atomic():
                locked_email = SentEmail.objects.select_for_update().get(pk=email_obj.pk)
                if not locked_email.is_scheduled:
                    continue
                locked_email.is_scheduled = False
                locked_email.save(update_fields=["is_scheduled"])

            # 🔹 Account selection logic
            if shuffle_enabled and accounts:
                selected_account = accounts[account_index % len(accounts)]
                account_index += 1
            else:
                selected_account = locked_email.sending_account

            main_email = {
                "subject": locked_email.subject,
                "body": locked_email.message
            }

            # attachment
            attachment_file = None
            if locked_email.attachment:
                attachment_file = locked_email.attachment.file
                attachment_file.open()
                attachment_file.seek(0)

            # send email
            sendCampaignEmail(
                request=None,
                user=locked_email.user,
                target_audience=locked_email.target_audience,
                main_email=main_email,
                selected_account=selected_account,
                attachment=attachment_file
            )

        except Exception as e:
            logger.error(f"Email send failed: {e}")

        finally:
            if email_obj.attachment:
                email_obj.attachment.file.close()

        time.sleep(random.randint(2, 5))


def send_followup_emails():
    now = timezone.now()  # use datetime instead of .date()

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
            logger.error(f"Followup failed: {e}")