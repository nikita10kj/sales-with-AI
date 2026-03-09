import threading
import time
from datetime import datetime, timedelta
import logging
from .task_queue import TASK_QUEUE
from .email_tasks import send_bulk_campaign_emails,send_followup_emails
from django.utils import timezone

logger = logging.getLogger(__name__)


def _scheduler_thread():

    while True:

        now = timezone.now()

        next_run = now + timedelta(seconds=10)

        sleep_seconds = (next_run - now).total_seconds()

        logger.info(f"Next campaign check at {next_run}")

        time.sleep(sleep_seconds)

        TASK_QUEUE.enqueue(send_bulk_campaign_emails)
        TASK_QUEUE.enqueue(send_followup_emails)

def start_scheduler():
    t = threading.Thread(target=_scheduler_thread, daemon=True)
    t.start()
    logger.info("Campaign scheduler started")