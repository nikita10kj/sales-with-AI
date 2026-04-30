# # from django.apps import AppConfig


# # class GenerateEmailConfig(AppConfig):
# #     default_auto_field = 'django.db.models.BigAutoField'
# #     name = 'generate_email'

# from django.apps import AppConfig
# import threading


# class GenerateEmailConfig(AppConfig):
#     default_auto_field = 'django.db.models.BigAutoField'
#     name = 'generate_email'

#     _scheduler_started = False

#     def ready(self):

#         if not self._scheduler_started:

#             if threading.current_thread().name == "MainThread":

#                 from .scheduler import start_scheduler

#                 start_scheduler()

#                 self._scheduler_started = True
        

# from django.apps import AppConfig
# import threading
# import os


# class GenerateEmailConfig(AppConfig):
#     default_auto_field = 'django.db.models.BigAutoField'
#     name = 'generate_email'

#     def ready(self):
#         # Django autoreloader starts 2 processes:
#         # 1. Parent reloader (RUN_MAIN not set)
#         # 2. Child worker (RUN_MAIN = "true")
#         # We only want scheduler in the CHILD process
#         if os.environ.get("RUN_MAIN") != "true":
#             return

#         if threading.current_thread().name != "MainThread":
#             return

#         from .scheduler import start_scheduler
#         start_scheduler()


from django.apps import AppConfig
import threading
import os


class GenerateEmailConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'generate_email'

    def ready(self):
        # Only start in main process, not in migration/management commands
        if os.environ.get("RUN_MAIN") == "true" or not os.environ.get("RUN_MAIN"):
            # RUN_MAIN == "true" -> Development with autoreloader
            # RUN_MAIN not set -> Production/Gunicorn
            
            if threading.current_thread().name == "MainThread":
                from .scheduler import start_scheduler
                start_scheduler()