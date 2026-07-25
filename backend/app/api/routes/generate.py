from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import List
import uuid

from app.database import get_db
from app.schemas.image import GenerateRequest, GenerateResponse, TaskStatusResponse
from app.services.image_service import (
    create_image_record,
    get_image_by_task_id,
    get_image_by_id,
)
from app.tasks.celery_worker import generate_image_task

router = APIRouter(prefix="/api", tags=["Generation"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_status_response(record) -> TaskStatusResponse:
    return TaskStatusResponse(
        task_id=record.task_id,
        image_id=record.id,
        status=record.status,
        image_url=f"/uploads/{record.id}.png" if record.file_path else None,
        width=record.width,
        height=record.height,
        current_step=record.current_step,
        total_steps=record.total_steps,
        error_message=record.error_message,
    )


# ---------------------------------------------------------------------------
# Single generation
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=GenerateResponse, status_code=202)
async def generate(
    payload: GenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Enqueues a single image generation task.
    Returns task_id immediately — client polls /status/{task_id}.
    """
    task_id = str(uuid.uuid4())
    record  = await create_image_record(
        db, prompt=payload.prompt, task_id=task_id
    )
    generate_image_task.apply_async(
        args=[record.id, payload.prompt],
        kwargs={"task_index": 0},
        task_id=task_id,
    )
    return GenerateResponse(
        task_id=task_id,
        image_id=record.id,
        message="Image generation queued.",
    )


# ---------------------------------------------------------------------------
# Batch generation
# ---------------------------------------------------------------------------

class BatchGenerateRequest(BaseModel):
    prompt:   str = Field(..., min_length=3, max_length=500)
    quantity: int = Field(..., ge=1, le=20)


class BatchGenerateItem(BaseModel):
    task_id:  str
    image_id: str


class BatchGenerateResponse(BaseModel):
    tasks:   List[BatchGenerateItem]
    total:   int
    message: str


@router.post(
    "/generate/batch",
    response_model=BatchGenerateResponse,
    status_code=202,
)
async def generate_batch(
    payload: BatchGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Enqueues N image generation tasks simultaneously.

    Each task receives its batch index (task_index) so the Celery worker
    can stagger Replicate API calls to avoid 429 rate-limit errors.

    Local and mock modes ignore task_index — no staggering needed.
    """
    tasks = []
    for i in range(payload.quantity):
        task_id = str(uuid.uuid4())
        record  = await create_image_record(
            db, prompt=payload.prompt, task_id=task_id
        )
        generate_image_task.apply_async(
            args=[record.id, payload.prompt],
            kwargs={"task_index": i},   # stagger index for Replicate
            task_id=task_id,
        )
        tasks.append(BatchGenerateItem(
            task_id=task_id,
            image_id=record.id,
        ))

    return BatchGenerateResponse(
        tasks=tasks,
        total=payload.quantity,
        message=f"{payload.quantity} generation tasks queued.",
    )


# ---------------------------------------------------------------------------
# Status endpoints
# ---------------------------------------------------------------------------

@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_status(
    task_id: str,
    db: AsyncSession = Depends(get_db),
):
    record = await get_image_by_task_id(db, task_id)
    if not record:
        raise HTTPException(status_code=404, detail="Task not found.")
    return _build_status_response(record)


@router.get("/image/{image_id}", response_model=TaskStatusResponse)
async def get_image(
    image_id: str,
    db: AsyncSession = Depends(get_db),
):
    record = await get_image_by_id(db, image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found.")
    return _build_status_response(record)