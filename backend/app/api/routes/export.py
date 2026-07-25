"""
Multi-format export endpoint.

Supports server-side ZIP export with all annotation formats.
The frontend can also do client-side export using lib/exportFormats.ts.

Formats:
  - coco    → Single annotations.json (COCO format)
  - yolo    → One .txt per image with normalized coords
  - voc     → One .xml per image (Pascal VOC format)
  - csv     → Single annotations.csv spreadsheet
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Literal
import zipfile
import json
import csv
import io
import os

from app.database import get_db
from app.models.image import GeneratedImage, Annotation, TaskStatus

router = APIRouter(prefix="/api", tags=["Export"])


class ExportAnnotation(BaseModel):
    label:       str
    x:           float
    y:           float
    bbox_width:  float
    bbox_height: float


class ExportImage(BaseModel):
    image_id:    str
    file_name:   str
    width:       int
    height:      int
    annotations: List[ExportAnnotation]


class ExportRequest(BaseModel):
    image_ids: List[str]
    format:    Literal["coco", "yolo", "voc", "csv"]


# ---------------------------------------------------------------------------
# Format converters
# ---------------------------------------------------------------------------

def to_coco(images: List[ExportImage]) -> str:
    """Convert to COCO JSON format."""
    category_map: dict[str, int] = {}
    coco_images      = []
    coco_annotations = []
    ann_id           = 1

    for i, img in enumerate(images):
        coco_images.append({
            "id":        i + 1,
            "file_name": img.file_name,
            "width":     img.width,
            "height":    img.height,
        })
        for ann in img.annotations:
            if ann.label not in category_map:
                category_map[ann.label] = len(category_map) + 1
            coco_annotations.append({
                "id":          ann_id,
                "image_id":    i + 1,
                "category_id": category_map[ann.label],
                "bbox":        [
                    round(ann.x, 2),
                    round(ann.y, 2),
                    round(ann.bbox_width, 2),
                    round(ann.bbox_height, 2),
                ],
                "area":    round(ann.bbox_width * ann.bbox_height, 2),
                "iscrowd": 0,
            })
            ann_id += 1

    categories = [
        {"id": v, "name": k, "supercategory": "object"}
        for k, v in category_map.items()
    ]

    return json.dumps({
        "info": {
            "description":  "Synthetic Data Suite Export",
            "version":      "1.0",
            "date_created": __import__("datetime").datetime.utcnow().isoformat(),
        },
        "images":      coco_images,
        "annotations": coco_annotations,
        "categories":  categories,
    }, indent=2)


def to_yolo_label(ann: ExportAnnotation, img_w: int, img_h: int,
                  class_id: int) -> str:
    """
    YOLO format: <class_id> <cx> <cy> <w> <h>
    All values normalized to 0-1 relative to image dimensions.
    """
    cx = (ann.x + ann.bbox_width  / 2) / img_w
    cy = (ann.y + ann.bbox_height / 2) / img_h
    w  = ann.bbox_width  / img_w
    h  = ann.bbox_height / img_h
    return f"{class_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"


def to_voc_xml(img: ExportImage) -> str:
    """Pascal VOC XML format."""
    objects = ""
    for ann in img.annotations:
        xmin = round(ann.x)
        ymin = round(ann.y)
        xmax = round(ann.x + ann.bbox_width)
        ymax = round(ann.y + ann.bbox_height)
        objects += f"""
    <object>
        <name>{ann.label}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
            <xmin>{xmin}</xmin>
            <ymin>{ymin}</ymin>
            <xmax>{xmax}</xmax>
            <ymax>{ymax}</ymax>
        </bndbox>
    </object>"""

    return f"""<?xml version="1.0" encoding="utf-8"?>
<annotation>
    <folder>images</folder>
    <filename>{img.file_name}</filename>
    <size>
        <width>{img.width}</width>
        <height>{img.height}</height>
        <depth>3</depth>
    </size>
    <segmented>0</segmented>{objects}
</annotation>"""


# ---------------------------------------------------------------------------
# Export endpoint
# ---------------------------------------------------------------------------

@router.post("/export/zip")
async def export_zip(
    payload: ExportRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Server-side ZIP export in any supported format.

    Returns a ZIP file containing:
      - coco:  images/ + annotations.json
      - yolo:  images/ + labels/ + classes.txt
      - voc:   images/ + annotations/ (one XML per image)
      - csv:   images/ + annotations.csv
    """
    if not payload.image_ids:
        raise HTTPException(status_code=400, detail="No image IDs provided.")

    # Load images from DB
    result = await db.execute(
        select(GeneratedImage).where(
            GeneratedImage.id.in_(payload.image_ids),
            GeneratedImage.status == TaskStatus.SUCCESS,
        )
    )
    db_images = list(result.scalars().all())

    if not db_images:
        raise HTTPException(
            status_code=404,
            detail="No successful images found for given IDs."
        )

    # Load annotations for each image
    export_images: List[ExportImage] = []
    for i, db_img in enumerate(db_images):
        ann_result = await db.execute(
            select(Annotation).where(Annotation.image_id == db_img.id)
        )
        db_anns = list(ann_result.scalars().all())

        export_images.append(ExportImage(
            image_id=db_img.id,
            file_name=f"image_{str(i+1).zfill(3)}.png",
            width=db_img.width  or 512,
            height=db_img.height or 512,
            annotations=[
                ExportAnnotation(
                    label=a.label,
                    x=a.x,
                    y=a.y,
                    bbox_width=a.bbox_width,
                    bbox_height=a.bbox_height,
                )
                for a in db_anns
            ],
        ))

    # Build ZIP in memory
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:

        # Add images
        for i, db_img in enumerate(db_images):
            file_name = f"image_{str(i+1).zfill(3)}.png"
            if db_img.file_path and os.path.exists(db_img.file_path):
                zf.write(db_img.file_path, f"images/{file_name}")

        # Add annotations in requested format
        if payload.format == "coco":
            zf.writestr("annotations.json", to_coco(export_images))

        elif payload.format == "yolo":
            # Build class list
            all_labels = list({
                a.label
                for img in export_images
                for a in img.annotations
            })
            class_to_id = {label: i for i, label in enumerate(all_labels)}

            # classes.txt
            zf.writestr("classes.txt", "\n".join(all_labels))

            # One .txt per image
            for img in export_images:
                stem = img.file_name.replace(".png", "")
                lines = [
                    to_yolo_label(a, img.width, img.height,
                                  class_to_id[a.label])
                    for a in img.annotations
                ]
                zf.writestr(
                    f"labels/{stem}.txt",
                    "\n".join(lines)
                )

        elif payload.format == "voc":
            for img in export_images:
                stem = img.file_name.replace(".png", "")
                zf.writestr(
                    f"annotations/{stem}.xml",
                    to_voc_xml(img)
                )

        elif payload.format == "csv":
            csv_buffer = io.StringIO()
            writer = csv.writer(csv_buffer)
            writer.writerow([
                "image_file", "image_width", "image_height",
                "label", "x", "y", "width", "height",
                "x_norm", "y_norm", "w_norm", "h_norm",
            ])
            for img in export_images:
                for ann in img.annotations:
                    writer.writerow([
                        img.file_name,
                        img.width,
                        img.height,
                        ann.label,
                        round(ann.x, 2),
                        round(ann.y, 2),
                        round(ann.bbox_width, 2),
                        round(ann.bbox_height, 2),
                        round(ann.x / img.width, 6),
                        round(ann.y / img.height, 6),
                        round(ann.bbox_width  / img.width,  6),
                        round(ann.bbox_height / img.height, 6),
                    ])
            zf.writestr("annotations.csv", csv_buffer.getvalue())

        # Always include a README
        readme = f"""# Synthetic Data Suite — Export
Format:  {payload.format.upper()}
Images:  {len(export_images)}
Date:    {__import__("datetime").datetime.utcnow().isoformat()}

## Format Notes
{"COCO JSON: Use with PyTorch, Detectron2, MMDetection" if payload.format == "coco" else ""}
{"YOLO: Use with Ultralytics YOLOv8 — point dataset yaml to this folder" if payload.format == "yolo" else ""}
{"Pascal VOC: Use with TensorFlow Object Detection API, OpenCV" if payload.format == "voc" else ""}
{"CSV: Open in Excel/Pandas for data analysis" if payload.format == "csv" else ""}
"""
        zf.writestr("README.txt", readme)

    zip_buffer.seek(0)

    fmt   = payload.format
    fname = f"synthetic_dataset_{fmt}.zip"

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={fname}"},
    )