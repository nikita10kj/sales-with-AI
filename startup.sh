##!/bin/bash
#
#LOCK_FILE="/tmp/saleswithai_startup.lock"
#
## Acquire lock, wait if already locked
#exec 9>"$LOCK_FILE"
#flock -n 9 || {
#    echo "Startup script already running. Exiting..."
#    exit 1
#}
## Activate virtualenv
#source ./venv/bin/activate
#
## Run migrations and collectstatic (optional)
#python manage.py migrate
#python manage.py collectstatic --noinput
#
## Define PID files
#CELERY_WORKER_PID="/tmp/celery_worker.pid"
#CELERY_BEAT_PID="/tmp/celery_beat.pid"
#
## Kill old Celery Worker if running
#if [ -f "$CELERY_WORKER_PID" ]; then
#    kill -9 $(cat "$CELERY_WORKER_PID") || true
#    rm "$CELERY_WORKER_PID"
#fi
#
## Kill old Celery Beat if running
#if [ -f "$CELERY_BEAT_PID" ]; then
#    kill -9 $(cat "$CELERY_BEAT_PID") || true
#    rm "$CELERY_BEAT_PID"
#fi
#
## Start Celery Worker (background)
#celery -A saleswithai worker --loglevel=info --pidfile="$CELERY_WORKER_PID" &
#
## Start Celery Beat (background)
#celery -A saleswithai beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler --pidfile="$CELERY_BEAT_PID" &
#
## Start Gunicorn server
#exec gunicorn saleswithai.wsgi --bind=0.0.0.0:8000
