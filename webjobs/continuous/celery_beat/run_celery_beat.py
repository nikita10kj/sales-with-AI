# run_celery_beat.py
from saleswithai.celery import app

if __name__ == '__main__':
    app.start(argv=['celery', 'beat', '--loglevel=info', '--scheduler', 'django_celery_beat.schedulers:DatabaseScheduler'])
