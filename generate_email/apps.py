# from django.apps import AppConfig


# class GenerateEmailConfig(AppConfig):
#     default_auto_field = 'django.db.models.BigAutoField'
#     name = 'generate_email'

from django.apps import AppConfig
import threading


class GenerateEmailConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'generate_email'

    _scheduler_started = False

    def ready(self):

        if not self._scheduler_started:

            if threading.current_thread().name == "MainThread":

                from .scheduler import start_scheduler

                start_scheduler()

                self._scheduler_started = True
        