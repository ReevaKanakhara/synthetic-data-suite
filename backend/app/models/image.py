import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, Integer, Float, ForeignKey, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


class TaskStatus(str, enum.Enum):
    PENDING    = "PENDING"
    PROCESSING = "PROCESSING"
    SUCCESS    = "SUCCESS"
    FAILURE    = "FAILURE"


class GeneratedImage(Base):
    """
    Represents a single AI-generated image and its associated task state.

    Step tracking fields (current_step / total_steps) are updated in
    real-time by the Celery worker's diffusion callback so the frontend
    can display inner-loop progress during PROCESSING state.
    """
    __tablename__ = "generated_images"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    task_id: Mapped[str] = mapped_column(
        String(36), unique=True, index=True, nullable=False
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False
    )
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Raw pixel dimensions
    width:  Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # --- Step tracking ---
    # Updated every step by the diffusion callback so frontend can
    # show inner-loop progress without polling the terminal.
    current_step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_steps:  Mapped[int | None] = mapped_column(Integer, nullable=True)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda:  datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    annotations: Mapped[list["Annotation"]] = relationship(
        back_populates="image", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<GeneratedImage id={self.id} status={self.status}>"


class Annotation(Base):
    """
    A single bounding box annotation on a GeneratedImage.

    All coordinates are stored in ORIGINAL IMAGE pixel space.
    The frontend scales canvas coords before sending.
    COCO format: x, y = top-left corner; w, h = box dimensions.
    """
    __tablename__ = "annotations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    image_id: Mapped[str] = mapped_column(
        ForeignKey("generated_images.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    label:       Mapped[str]   = mapped_column(String(255), nullable=False)
    x:           Mapped[float] = mapped_column(Float, nullable=False)
    y:           Mapped[float] = mapped_column(Float, nullable=False)
    bbox_width:  Mapped[float] = mapped_column(Float, nullable=False)
    bbox_height: Mapped[float] = mapped_column(Float, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    image: Mapped["GeneratedImage"] = relationship(back_populates="annotations")