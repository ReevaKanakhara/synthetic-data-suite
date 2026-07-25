from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
import os

from app.database import get_db
from app.schemas.image import TaskStatusResponse
from app.services.image_service import (
    get_all_images,
    get_images_count,
    delete_image_record,
    get_image_by_id,
)

router = APIRouter(prefix="/api", tags=["Gallery"])


class GalleryResponse(BaseModel):
    images: list[TaskStatusResponse]
    total: int
    skip: int
    limit: int


@router.get("/images", response_model=GalleryResponse)
async def list_images(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    """
    Returns paginated list of all generated images, newest first.
    Used by the Gallery page to display all previous generations.
    """
    images = await get_all_images(db, skip=skip, limit=limit)
    total = await get_images_count(db)

    result = []
    for img in images:
        image_url = f"/uploads/{img.id}.png" if img.file_path else None
        result.append(
            TaskStatusResponse(
                task_id=img.task_id,
                image_id=img.id,
                status=img.status,
                image_url=image_url,
                width=img.width,
                height=img.height,
                error_message=img.error_message,
            )
        )

    return GalleryResponse(
        images=result,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.delete("/images/{image_id}")
async def delete_image(
    image_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Deletes image record from database and PNG file from disk.
    This is permanent and cannot be undone.
    """
    success = await delete_image_record(db, image_id)
    if not success:
        raise HTTPException(status_code=404, detail="Image not found.")
    return {"deleted": True, "image_id": image_id}


@router.get("/images/{image_id}/download")
async def download_image(
    image_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Streams the raw PNG file as a download.
    Returns 404 if image record or file not found.
    """
    record = await get_image_by_id(db, image_id)
    if not record or not record.file_path:
        raise HTTPException(status_code=404, detail="Image not found.")
    if not os.path.exists(record.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk.")

    return FileResponse(
        path=record.file_path,
        media_type="image/png",
        filename=f"synthetic_{image_id[:8]}.png",
    )