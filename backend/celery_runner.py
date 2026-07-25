"""
Run this script to start the Celery worker:
    python celery_runner.py

Or directly with the celery CLI:
    celery -A app.tasks.celery_worker.celery_app worker --loglevel=info
"""
from app.tasks.celery_worker import celery_app

if __name__ == "__main__":
    celery_app.worker_main(["worker", "--loglevel=info", "--concurrency=2"])