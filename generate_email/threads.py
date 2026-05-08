# search/threads.py
import threading
import logging
import time

logger = logging.getLogger(__name__)


def run_enrichment_polling(job_id):
    """
    Spawns a daemon thread that polls EnrichmentRequests until all are done.
    Called once after redrob_start_bulk_enrichment succeeds.
    """
    thread = threading.Thread(
        target=_poll_job,
        args=(job_id,),
        daemon=True,   # dies if main process dies — fine for gunicorn workers
        name=f"enrich-job-{job_id}",
    )
    thread.start()
    logger.info("Started enrichment thread for job %s", job_id)


def _poll_job(job_id):
    """
    Runs inside the background thread.
    Polls every 15 seconds, up to 40 attempts (~10 minutes).
    """
    # Import inside thread to avoid Django app-registry issues
    import django
    django.setup()          # safe to call multiple times

    from django.utils import timezone
    from .models import (
        EnrichmentJob,
        EnrichmentRequest,
        SavedPeopleEntry,
        UserSearchLimit,
        SearchHistory,
        GlobalSearchLog,
    )

    MAX_ATTEMPTS  = 40
    POLL_INTERVAL = 15     # seconds

    try:
        job = EnrichmentJob.objects.get(id=job_id)
    except EnrichmentJob.DoesNotExist:
        logger.error("EnrichmentJob %s not found in thread", job_id)
        return

    done_statuses = {"FINISHED", "FAILED", "ERROR"}

    for attempt in range(1, MAX_ATTEMPTS + 1):
        time.sleep(POLL_INTERVAL)

        try:
            requests_qs = EnrichmentRequest.objects.filter(
                request_id__in=job.request_ids,
                user=job.user,
            )

            done_count = 0
            total      = len(job.request_ids)

            for er in requests_qs:
                if er.status not in done_statuses:
                    continue

                done_count += 1

                emails = er.emails or []
                phones = er.phones or []

                first_email = (
                    emails[0].get("email", "")
                    if emails and isinstance(emails[0], dict)
                    else (emails[0] if emails else "")
                )
                first_phone = (
                    phones[0].get("number", "")
                    if phones and isinstance(phones[0], dict)
                    else (phones[0] if phones else "")
                )

                # ── Credit deduction (idempotent) ─────────────────────────
                if not er.credits_deducted and (first_email or first_phone):
                    try:
                        sl, _ = UserSearchLimit.objects.get_or_create(user=job.user)
                        credit_cost = 0
                        if first_email:
                            credit_cost += 1
                        if first_phone:
                            credit_cost += 3
                        if credit_cost and sl.has_credits() and sl.credits >= credit_cost:
                            sl.deduct(credit_cost)
                            logger.info(
                                "Thread deducted %d credits for request %s",
                                credit_cost, er.request_id,
                            )
                    except Exception as exc:
                        logger.warning("Credit deduction error: %s", exc)

                    # ── Write email/phone back to SavedPeopleEntry ────────
                    update_fields = {}
                    if first_email:
                        update_fields["email"] = first_email
                    if first_phone:
                        update_fields["phone"] = first_phone

                    if update_fields:
                        SavedPeopleEntry.objects.filter(
                            saved_list__user=job.user,
                            linkedin__iexact=er.linkedin,
                        ).update(**update_fields)

                    EnrichmentRequest.objects.filter(
                        request_id=er.request_id
                    ).update(credits_deducted=True)

                # ── Patch SearchHistory & GlobalSearchLog ─────────────────
                if first_email or first_phone:
                    try:
                        norm_url = er.linkedin.strip().lower().rstrip("/")

                        def _patch(model_cls):
                            records = list(
                                model_cls.objects.filter(
                                    user=job.user,
                                    search_type__in=["people", "linkedin"],
                                ).order_by("-created_at")[:20]
                            )
                            for record in records:
                                if not record.results:
                                    continue
                                changed = False
                                for r in record.results:
                                    r_url = (
                                        r.get("linkedin", "")
                                        .strip().lower().rstrip("/")
                                    )
                                    if r_url == norm_url:
                                        if first_email:
                                            r["email"] = first_email
                                        if first_phone:
                                            r["phone"] = first_phone
                                        changed = True
                                if changed:
                                    model_cls.objects.filter(
                                        id=record.id
                                    ).update(results=record.results)

                        _patch(SearchHistory)
                        _patch(GlobalSearchLog)
                    except Exception as exc:
                        logger.warning("SearchHistory patch error: %s", exc)

            # ── Update job progress ───────────────────────────────────────
            job.done_count = done_count
            if done_count >= total:
                job.status       = "COMPLETED"
                job.completed_at = timezone.now()
                job.save(update_fields=["done_count", "status", "completed_at"])
                logger.info(
                    "EnrichmentJob %s COMPLETED (%d/%d) after %d attempts",
                    job_id, done_count, total, attempt,
                )
                return  # all done — exit thread

            job.save(update_fields=["done_count"])
            logger.info(
                "EnrichmentJob %s progress %d/%d (attempt %d/%d)",
                job_id, done_count, total, attempt, MAX_ATTEMPTS,
            )

        except Exception as exc:
            logger.exception("Error in enrichment thread attempt %d: %s", attempt, exc)
            # Don't break — keep retrying on transient DB errors

    # Exhausted all attempts
    try:
        job.status = "FAILED"
        job.save(update_fields=["status"])
        logger.error("EnrichmentJob %s timed out after %d attempts", job_id, MAX_ATTEMPTS)
    except Exception:
        pass