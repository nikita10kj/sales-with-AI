import threading
import time
import logging
import os
from django.utils import timezone
from datetime import timedelta
from .task_queue import TASK_QUEUE
from .email_tasks import send_bulk_campaign_emails, send_followup_emails

logger = logging.getLogger(__name__)

_scheduler_lock = threading.Lock()
_scheduler_started = False


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
    global _scheduler_started

    with _scheduler_lock:
        if _scheduler_started:
            logger.info("Scheduler already running — skipping duplicate start")
            return

        t = threading.Thread(target=_scheduler_thread, daemon=True, name="CampaignScheduler")
        t.start()
        _scheduler_started = True
        logger.info("Campaign scheduler started")