#!/bin/bash

# Activate virtualenv
source ./venv/bin/activate

# Run migrations and collectstatic (optional)
python manage.py migrate
python manage.py collectstatic --noinput

# Kill all running celery processes
pkill -f 'celery'
# Start Celery Worker (background)
celery -A saleswithai worker --loglevel=info &

# Start Celery Beat (background)
celery -A saleswithai beat --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler &

# Start Gunicorn server
exec gunicorn saleswithai.wsgi --bind=0.0.0.0:8000
