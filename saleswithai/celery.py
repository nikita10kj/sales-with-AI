# import os
# from celery import Celery
# from .settings import CELERY_BEAT_SCHEDULE
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'saleswithai.settings')
#
# app = Celery('saleswithai')
# # Fix the worker_state_db error
# app.config_from_object('django.conf:settings', namespace='CELERY')
# # app.conf.beat_schedule = CELERY_BEAT_SCHEDULE
# import socket
# print(f"[{socket.gethostname()}] Running send_reminders")
# # Fix for 'worker_state_db' attribute error (remove deprecated setting)
# # if hasattr(app.conf, 'worker_state_db'):
# #     delattr(app.conf, 'worker_state_db')
# app.autodiscover_tasks()
