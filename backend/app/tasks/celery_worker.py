from celery import Celery
from celery.utils.log import get_task_logger
from app.config import settings

logger = get_task_logger(__name__)

celery_app = Celery(
    "synthetic_data_suite",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
)


@celery_app.task(bind=True, max_retries=2, name="tasks.generate_image")
def generate_image_task(
    self,
    image_id:   str,
    prompt:     str,
    task_index: int = 0,
):
    """
    Celery task: orchestrates image generation and DB persistence.

    task_index — position of this task in a batch (0-based).
    Used to stagger Replicate API calls so we don't hit rate limits.

    Replicate free tier allows 1 concurrent request.
    We wait (task_index * 12) seconds before starting so each task
    in a batch is spaced 12 seconds apart — well within the 6/min limit.

    Step callback writes (current_step, total_steps) to DB every 2 steps
    so the frontend can show inner-loop progress in real time.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.models.image import GeneratedImage, TaskStatus
    from ml.pipeline import generate_image
    import traceback
    import time

    # -------------------------------------------------------------------
    # Stagger Replicate API calls to avoid 429 rate-limit errors.
    # Local and mock modes don't need staggering.
    # -------------------------------------------------------------------
    if settings.model_backend == "replicate" and task_index > 0:
        wait_seconds = task_index * 12
        logger.info(
            f"[Task] Replicate stagger: sleeping {wait_seconds}s "
            f"(batch position {task_index + 1})"
        )
        time.sleep(wait_seconds)

    sync_url = settings.database_url.replace("+aiosqlite", "")
    engine   = create_engine(
        sync_url, connect_args={"check_same_thread": False}
    )
    Session = sessionmaker(bind=engine)

    logger.info(
        f"[Task] Starting | image_id={image_id} "
        f"prompt='{prompt[:60]}'"
    )

    with Session() as session:
        record: GeneratedImage = session.get(GeneratedImage, image_id)
        if not record:
            logger.error(f"[Task] Record not found: {image_id}")
            return

        try:
            # Mark as in-progress
            record.status = TaskStatus.PROCESSING
            session.commit()

            # -----------------------------------------------------------
            # Step callback — updates DB every 2 steps for UI progress
            # -----------------------------------------------------------
            def on_step(step: int, total: int):
                if step % 2 == 0 or step == total:
                    try:
                        with Session() as step_session:
                            rec = step_session.get(GeneratedImage, image_id)
                            if rec:
                                rec.current_step = step
                                rec.total_steps  = total
                                step_session.commit()
                    except Exception as e:
                        logger.warning(f"[Task] Step write failed: {e}")

            # -----------------------------------------------------------
            # Run the ML pipeline
            # -----------------------------------------------------------
            img, width, height = generate_image(
                prompt=prompt,
                step_callback=on_step,
            )

            # Save image to disk
            output_path = settings.uploads_dir / f"{image_id}.png"
            img.save(str(output_path), format="PNG", optimize=True)
            logger.info(f"[Task] Saved → {output_path}")

            # Mark as SUCCESS
            record.status       = TaskStatus.SUCCESS
            record.file_path    = str(output_path)
            record.width        = width
            record.height       = height
            record.current_step = None
            record.total_steps  = None
            session.commit()

            logger.info(f"[Task] Complete | image_id={image_id}")
            return {
                "status":   "SUCCESS",
                "image_id": image_id,
                "size":     f"{width}x{height}",
            }

        except Exception as exc:
            logger.error(
                f"[Task] Failed | image_id={image_id} | {exc}"
            )
            logger.debug(traceback.format_exc())

            record.status        = TaskStatus.FAILURE
            record.error_message = str(exc)[:500]
            session.commit()

            raise self.retry(
                exc=exc,
                countdown=30 * (self.request.retries + 1),
            )