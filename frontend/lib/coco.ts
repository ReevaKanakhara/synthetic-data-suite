import { BoundingBox, COCOExport } from "@/types";

/**
 * Converts canvas bounding boxes to COCO JSON format.
 *
 * IMPORTANT — Coordinate convention:
 * All box coordinates passed here must already be scaled to
 * the original image's pixel space (not canvas/screen space).
 * The AnnotationCanvas component handles this scaling before calling here.
 */
export function exportToCOCO(
  imageId: string,
  fileName: string,
  imageWidth: number,
  imageHeight: number,
  boxes: BoundingBox[]
): COCOExport {
  // Build unique category list from labels
  const uniqueLabels = [...new Set(boxes.map((b) => b.label))];
  const categories = uniqueLabels.map((name, idx) => ({
    id: idx + 1,
    name,
    supercategory: "object",
  }));

  const labelToId = Object.fromEntries(
    categories.map((c) => [c.name, c.id])
  );

  const annotations = boxes.map((box, idx) => ({
    id: idx + 1,
    image_id: 1,
    category_id: labelToId[box.label],
    // COCO format: [x_topleft, y_topleft, width, height]
    bbox: [
      Math.round(box.x),
      Math.round(box.y),
      Math.round(box.width),
      Math.round(box.height),
    ] as [number, number, number, number],
    area: Math.round(box.width * box.height),
    iscrowd: 0 as 0 | 1,
  }));

  return {
    info: {
      description: "Synthetic Data Suite — Generated Dataset",
      version: "1.0",
      date_created: new Date().toISOString(),
    },
    images: [
      {
        id: 1,
        file_name: fileName,
        width: imageWidth,
        height: imageHeight,
      },
    ],
    annotations,
    categories,
  };
}