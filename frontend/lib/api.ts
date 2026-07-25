import axios from "axios";
import { GenerateResponse, TaskStatusResponse } from "@/types";

const api = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ---------------------------------------------------------------------------
// Single generation
// ---------------------------------------------------------------------------

export async function generateImage(
  prompt: string
): Promise<GenerateResponse> {
  const res = await api.post<GenerateResponse>("/api/generate", { prompt });
  return res.data;
}

export async function getTaskStatus(
  taskId: string
): Promise<TaskStatusResponse> {
  const res = await api.get<TaskStatusResponse>(`/api/status/${taskId}`);
  return res.data;
}

// ---------------------------------------------------------------------------
// Batch generation
// ---------------------------------------------------------------------------

export interface BatchTask {
  task_id:  string;
  image_id: string;
}

export interface BatchGenerateResponse {
  tasks:   BatchTask[];
  total:   number;
  message: string;
}

export async function generateBatch(
  prompt: string,
  quantity: number
): Promise<BatchGenerateResponse> {
  const res = await api.post<BatchGenerateResponse>(
    "/api/generate/batch",
    { prompt, quantity }
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Gallery
// ---------------------------------------------------------------------------

export interface GalleryResponse {
  images: TaskStatusResponse[];
  total:  number;
  skip:   number;
  limit:  number;
}

export async function getGallery(
  skip  = 0,
  limit = 100
): Promise<GalleryResponse> {
  const res = await api.get<GalleryResponse>(
    `/api/images?skip=${skip}&limit=${limit}`
  );
  return res.data;
}

export async function deleteImage(imageId: string): Promise<void> {
  await api.delete(`/api/images/${imageId}`);
}

// ---------------------------------------------------------------------------
// Auto-label
// ---------------------------------------------------------------------------

export interface AutoLabelBox {
  label:       string;
  confidence:  number;
  x:           number;
  y:           number;
  bbox_width:  number;
  bbox_height: number;
}

export interface AutoLabelResponse {
  image_id: string;
  boxes:    AutoLabelBox[];
  total:    number;
  model:    string;
  message:  string;
}

export async function autoLabelImage(
  imageId:    string,
  confidence: number = 0.25
): Promise<AutoLabelResponse> {
  const res = await api.post<AutoLabelResponse>(
    `/api/images/${imageId}/autolabel?confidence=${confidence}`
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// ZIP Export
// ---------------------------------------------------------------------------

export interface ZipExportItem {
  imageId:     string;
  imageUrl:    string;
  annotations: import("@/types").BoundingBox[];
  width:       number;
  height:      number;
}

export async function buildAndDownloadZip(
  items:  ZipExportItem[],
  prompt: string
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip   = new JSZip();
  const imagesFolder = zip.folder("images")!;
  const date  = new Date().toISOString().split("T")[0];

  const cocoImages:      object[] = [];
  const cocoAnnotations: object[] = [];
  const categoryMap = new Map<string, number>();
  let annotationId  = 1;

  for (let i = 0; i < items.length; i++) {
    const item     = items[i];
    const fileName = `image_${String(i + 1).padStart(3, "0")}.png`;

    try {
      const response = await fetch(item.imageUrl);
      const blob     = await response.blob();
      imagesFolder.file(fileName, blob);
    } catch {
      console.warn(`Failed to fetch image ${item.imageId}`);
    }

    cocoImages.push({
      id:        i + 1,
      file_name: `images/${fileName}`,
      width:     item.width,
      height:    item.height,
    });

    item.annotations.forEach(box => {
      if (!categoryMap.has(box.label)) {
        categoryMap.set(box.label, categoryMap.size + 1);
      }
      cocoAnnotations.push({
        id:          annotationId++,
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
  }

  const categories = Array.from(categoryMap.entries()).map(([name, id]) => ({
    id, name, supercategory: "object",
  }));

  const cocoJson = {
    info: {
      description:      "Synthetic Data Suite — Generated Dataset",
      prompt,
      version:          "1.0",
      date_created:     new Date().toISOString(),
      total_images:     items.length,
      total_annotations: cocoAnnotations.length,
    },
    images:      cocoImages,
    annotations: cocoAnnotations,
    categories,
  };

  zip.file("annotations.json",  JSON.stringify(cocoJson, null, 2));
  zip.file("dataset_info.json", JSON.stringify({
    prompt,
    date_created:  new Date().toISOString(),
    total_images:  items.length,
    model:         "stable-diffusion-v1-5",
    resolution:    "512x512",
    format:        "COCO JSON",
  }, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `synthetic_dataset_${date}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}