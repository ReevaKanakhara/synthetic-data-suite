from pydantic import BaseModel, Field
from datetime import datetime
from app.models.image import TaskStatus
from typing import Optional, List


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=500,
                        example="a red apple on a wooden table")


class AnnotationIn(BaseModel):
    label: str = Field(..., example="apple")
    x:           float = Field(..., ge=0)
    y:           float = Field(..., ge=0)
    bbox_width:  float = Field(..., gt=0)
    bbox_height: float = Field(..., gt=0)


class SaveAnnotationsRequest(BaseModel):
    annotations: List[AnnotationIn]


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class GenerateResponse(BaseModel):
    task_id:  str
    image_id: str
    message:  str = "Image generation queued."


class TaskStatusResponse(BaseModel):
    task_id:       str
    image_id:      str
    status:        TaskStatus
    image_url:     Optional[str] = None
    width:         Optional[int] = None
    height:        Optional[int] = None
    current_step:  Optional[int] = None
    total_steps:   Optional[int] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class AnnotationOut(BaseModel):
    id:          str
    label:       str
    x:           float
    y:           float
    bbox_width:  float
    bbox_height: float

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Auto-label schemas
# ---------------------------------------------------------------------------

class AutoLabelBox(BaseModel):
    """
    A single predicted bounding box from YOLOv8.
    Coordinates are in ORIGINAL IMAGE pixel space.
    """
    label:       str
    confidence:  float          # 0.0 to 1.0
    x:           float          # top-left x in image pixels
    y:           float          # top-left y in image pixels
    bbox_width:  float          # box width in image pixels
    bbox_height: float          # box height in image pixels


class AutoLabelResponse(BaseModel):
    image_id:    str
    boxes:       List[AutoLabelBox]
    total:       int
    model:       str = "yolov8n"
    message:     str