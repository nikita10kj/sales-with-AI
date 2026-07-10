import threading
import os
import logging
from .scheduler import start_scheduler
from .task_queue import TASK_QUEUE

logger = logging.getLogger(__name__)

class ThreadKeepAliveMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self._check_threads()

    def __call__(self, request):
        self._check_threads()
        return self.get_response(request)
        
    def _check_threads(self):
        # Do not start threads during management commands
        import sys
        if len(sys.argv) > 0 and sys.argv[0].endswith('manage.py') and 'runserver' not in sys.argv:
            return

        # Start Scheduler Thread if dead
        start_scheduler()

        # Start Task Queue Worker if dead
        alive_workers = [t for t in threading.enumerate() if getattr(t, '_is_task_worker', False) and t.is_alive()]
        if not alive_workers:
            logger.info("Task queue worker thread is dead. Restarting in current process.")
            t = threading.Thread(target=TASK_QUEUE._worker, daemon=True)
            t._is_task_worker = True
            t.start()
