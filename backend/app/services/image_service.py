from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.models.image import GeneratedImage, TaskStatus
import uuid
import os


async def create_image_record(
    db: AsyncSession, *, prompt: str, task_id: str
) -> GeneratedImage:
    """Creates a new GeneratedImage record in PENDING state."""
    record = GeneratedImage(
        id=str(uuid.uuid4()),
        task_id=task_id,
        prompt=prompt,
        status=TaskStatus.PENDING,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_image_by_task_id(
    db: AsyncSession, task_id: str
) -> GeneratedImage | None:
    result = await db.execute(
        select(GeneratedImage).where(GeneratedImage.task_id == task_id)
    )
    return result.scalar_one_or_none()


async def get_image_by_id(
    db: AsyncSession, image_id: str
) -> GeneratedImage | None:
    return await db.get(GeneratedImage, image_id)


async def get_all_images(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
) -> list[GeneratedImage]:
    """Returns all images ordered by newest first."""
    result = await db.execute(
        select(GeneratedImage)
        .order_by(desc(GeneratedImage.created_at))
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_images_count(db: AsyncSession) -> int:
    """Returns total count of all image records."""
    result = await db.execute(
        select(func.count()).select_from(GeneratedImage)
    )
    return result.scalar() or 0


async def delete_image_record(
    db: AsyncSession, image_id: str
) -> bool:
    """Deletes image record from DB and file from disk."""
    record = await db.get(GeneratedImage, image_id)
    if not record:
        return False
    if record.file_path and os.path.exists(record.file_path):
        os.remove(record.file_path)
    await db.delete(record)
    await db.commit()
    return True