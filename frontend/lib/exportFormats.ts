import { BoundingBox } from "@/types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ExportFormat = "coco" | "yolo" | "voc" | "csv";

export interface ExportImageData {
  imageId:     string;
  fileName:    string;
  imageUrl:    string;
  width:       number;
  height:      number;
  annotations: BoundingBox[];
}

// ---------------------------------------------------------------------------
// COCO JSON
// ---------------------------------------------------------------------------

export function toCOCO(images: ExportImageData[]): string {
  const categoryMap = new Map<string, number>();
  const cocoImages:      object[] = [];
  const cocoAnnotations: object[] = [];
  let annId = 1;

  images.forEach((img, i) => {
    cocoImages.push({
      id:        i + 1,
      file_name: img.fileName,
      width:     img.width,
      height:    img.height,
    });

    img.annotations.forEach(box => {
      if (!categoryMap.has(box.label)) {
        categoryMap.set(box.label, categoryMap.size + 1);
      }
      cocoAnnotations.push({
        id:          annId++,
        image_id:    i + 1,
        category_id: categoryMap.get(box.label)!,
        bbox: [
          Math.round(box.x),
          Math.round(box.y),
          Math.round(box.width),
          Math.round(box.height),
        ],
        area:    Math.round(box.width * box.height),
        iscrowd: 0,
      });
    });
  });

  const categories = Array.from(categoryMap.entries()).map(([name, id]) => ({
    id, name, supercategory: "object",
  }));

  return JSON.stringify({
    info: {
      description:  "Synthetic Data Suite Export",
      version:      "1.0",
      date_created: new Date().toISOString(),
    },
    images:      cocoImages,
    annotations: cocoAnnotations,
    categories,
  }, null, 2);
}

// ---------------------------------------------------------------------------
// YOLO .txt
// ---------------------------------------------------------------------------

export interface YOLOExport {
  classNames: string[];            // classes.txt content as array
  labels:     { name: string; content: string }[];  // one per image
}

export function toYOLO(images: ExportImageData[]): YOLOExport {
  // Build class list from all annotations
  const classSet = new Set<string>();
  images.forEach(img =>
    img.annotations.forEach(b => classSet.add(b.label))
  );
  const classNames  = Array.from(classSet);
  const classToId   = new Map(classNames.map((name, i) => [name, i]));

  const labels = images.map((img, i) => {
    const stem  = `image_${String(i + 1).padStart(3, "0")}`;
    const lines = img.annotations.map(box => {
      // Normalize to 0-1
      const cx = (box.x + box.width  / 2) / img.width;
      const cy = (box.y + box.height / 2) / img.height;
      const w  = box.width  / img.width;
      const h  = box.height / img.height;
      const id = classToId.get(box.label) ?? 0;
      return `${id} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
    });
    return { name: `${stem}.txt`, content: lines.join("\n") };
  });

  return { classNames, labels };
}

// ---------------------------------------------------------------------------
// Pascal VOC XML
// ---------------------------------------------------------------------------

export function toVOCXML(img: ExportImageData): string {
  const objects = img.annotations.map(box => {
    const xmin = Math.round(box.x);
    const ymin = Math.round(box.y);
    const xmax = Math.round(box.x + box.width);
    const ymax = Math.round(box.y + box.height);
    return `
  <object>
    <name>${box.label}</name>
    <pose>Unspecified</pose>
    <truncated>0</truncated>
    <difficult>0</difficult>
    <bndbox>
      <xmin>${xmin}</xmin>
      <ymin>${ymin}</ymin>
      <xmax>${xmax}</xmax>
      <ymax>${ymax}</ymax>
    </bndbox>
  </object>`;
  }).join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<annotation>
  <folder>images</folder>
  <filename>${img.fileName}</filename>
  <size>
    <width>${img.width}</width>
    <height>${img.height}</height>
    <depth>3</depth>
  </size>
  <segmented>0</segmented>${objects}
</annotation>`;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

export function toCSV(images: ExportImageData[]): string {
  const rows: string[] = [
    "image_file,image_width,image_height,label,x,y,width,height,x_norm,y_norm,w_norm,h_norm",
  ];

  images.forEach(img => {
    img.annotations.forEach(box => {
      rows.push([
        img.fileName,
        img.width,
        img.height,
        box.label,
        Math.round(box.x),
        Math.round(box.y),
        Math.round(box.width),
        Math.round(box.height),
        (box.x      / img.width).toFixed(6),
        (box.y      / img.height).toFixed(6),
        (box.width  / img.width).toFixed(6),
        (box.height / img.height).toFixed(6),
      ].join(","));
    });
  });

  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// Client-side ZIP builder (single image, from Annotation Studio)
// ---------------------------------------------------------------------------

export async function downloadSingleImageExport(
  img:    ExportImageData,
  format: ExportFormat,
): Promise<void> {
  const JSZip    = (await import("jszip")).default;
  const zip      = new JSZip();
  const date     = new Date().toISOString().split("T")[0];
  const stem     = `image_001`;
  const fileName = `${stem}.png`;

  // Fetch and add the image
  try {
    const resp = await fetch(img.imageUrl);
    const blob = await resp.blob();
    zip.folder("images")!.file(fileName, blob);
  } catch {
    console.warn("Could not fetch image for ZIP");
  }

  const exportImg = { ...img, fileName };

  if (format === "coco") {
    zip.file("annotations.json", toCOCO([exportImg]));

  } else if (format === "yolo") {
    const { classNames, labels } = toYOLO([exportImg]);
    zip.file("classes.txt", classNames.join("\n"));
    const labelsFolder = zip.folder("labels")!;
    labels.forEach(l => labelsFolder.file(l.name, l.content));

  } else if (format === "voc") {
    zip.folder("annotations")!.file(`${stem}.xml`, toVOCXML(exportImg));

  } else if (format === "csv") {
    zip.file("annotations.csv", toCSV([exportImg]));
  }

  // README
  const readmeMap: Record<ExportFormat, string> = {
    coco: "Use with PyTorch, Detectron2, MMDetection",
    yolo: "Use with Ultralytics YOLOv8 — point your dataset YAML to this folder",
    voc:  "Use with TensorFlow Object Detection API, OpenCV DNN",
    csv:  "Open in Excel or Pandas for data analysis and visualization",
  };
  zip.file("README.txt", `Synthetic Data Suite Export
Format: ${format.toUpperCase()}
Date:   ${date}
Images: 1
Annotations: ${img.annotations.length}

Usage: ${readmeMap[format]}
`);

  const blob = await zip.generateAsync({ type: "blob" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `synthetic_${format}_${date}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}