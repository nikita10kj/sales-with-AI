# run_celery_worker.py
from saleswithai.celery import app

if __name__ == '__main__':
    print(">>> Celery worker started on Azure")
    app.worker_main(argv=['worker', '--loglevel=info'])
