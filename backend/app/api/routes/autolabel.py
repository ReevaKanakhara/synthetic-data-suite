"""
Auto-labeling endpoint using YOLOv8-nano.

Design decisions:
- YOLOv8-nano (yolov8n.pt) is used — only 6MB, runs on CPU in ~0.5s
- Model is loaded as a module-level singleton to avoid reloading per request
- Coordinates are returned in original image pixel space
- Confidence threshold is configurable per request (default 0.25)
- If the image file doesn't exist on disk, returns 404
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.image import AutoLabelResponse, AutoLabelBox
from app.services.image_service import get_image_by_id
import os

router = APIRouter(prefix="/api", tags=["Auto-Label"])

# Module-level YOLO singleton — loaded once, reused across requests
_yolo_model = None


def get_yolo():
    """Lazy-loads YOLOv8-nano on first call."""
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        import logging
        logging.getLogger("ultralytics").setLevel(logging.WARNING)
        _yolo_model = YOLO("yolov8n.pt")  # auto-downloads ~6MB on first call
    return _yolo_model


@router.post("/images/{image_id}/autolabel", response_model=AutoLabelResponse)
async def autolabel_image(
    image_id: str,
    confidence: float = 0.25,
    db: AsyncSession = Depends(get_db),
):
    """
    Runs YOLOv8-nano inference on a generated image and returns
    predicted bounding boxes in original image pixel space.

    The frontend receives these boxes and displays them as
    "draft" annotations for the user to approve or reject.

    Args:
        image_id:   UUID of the generated image
        confidence: Minimum confidence threshold (0.0-1.0, default 0.25)

    Returns:
        List of AutoLabelBox objects with label, confidence, and coordinates
    """
    # Validate image exists in DB
    record = await get_image_by_id(db, image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image not found.")

    if record.status.value != "SUCCESS":
        raise HTTPException(
            status_code=400,
            detail="Image must be in SUCCESS state to auto-label."
        )

    if not record.file_path or not os.path.exists(record.file_path):
        raise HTTPException(
            status_code=404,
            detail="Image file not found on disk."
        )

    # Run YOLO inference
    try:
        model  = get_yolo()
        results = model(
            record.file_path,
            conf=confidence,
            verbose=False,
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"YOLO inference failed: {str(e)}"
        )

    # Parse results into our schema
    boxes: list[AutoLabelBox] = []
    result = results[0]   # single image → single result

    if result.boxes is not None:
        for box in result.boxes:
            # YOLO returns xyxy format — convert to xywh (top-left + size)
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            label      = result.names[int(box.cls[0])]
            confidence_score = float(box.conf[0])

            boxes.append(AutoLabelBox(
                label=label,
                confidence=round(confidence_score, 3),
                x=round(x1, 2),
                y=round(y1, 2),
                bbox_width=round(x2 - x1, 2),
                bbox_height=round(y2 - y1, 2),
            ))

    # Sort by confidence descending
    boxes.sort(key=lambda b: b.confidence, reverse=True)

    return AutoLabelResponse(
        image_id=image_id,
        boxes=boxes,
        total=len(boxes),
        model="yolov8n",
        message=f"Found {len(boxes)} object{'s' if len(boxes) != 1 else ''} "
                f"with confidence ≥ {confidence}",
    )