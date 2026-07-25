export type TaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE";

export interface GenerateResponse {
  task_id:  string;
  image_id: string;
  message:  string;
}

export interface TaskStatusResponse {
  task_id:       string;
  image_id:      string;
  status:        TaskStatus;
  image_url:     string | null;
  width:         number | null;
  height:        number | null;
  // Step tracking — populated during PROCESSING state
  current_step:  number | null;
  total_steps:   number | null;
  error_message: string | null;
}

export interface BoundingBox {
  id:     string;
  label:  string;
  x:      number;
  y:      number;
  width:  number;
  height: number;
}

export interface COCOAnnotation {
  id:          number;
  image_id:    number;
  category_id: number;
  bbox:        [number, number, number, number];
  area:        number;
  iscrowd:     0 | 1;
}

export interface COCOExport {
  info: {
    description:  string;
    version:      string;
    date_created: string;
  };
  images: {
    id:        number;
    file_name: string;
    width:     number;
    height:    number;
  }[];
  annotations: COCOAnnotation[];
  categories: {
    id:             number;
    name:           string;
    supercategory:  string;
  }[];
}

export interface GalleryImage {
  task_id:   string;
  image_id:  string;
  status:    TaskStatus;
  image_url: string | null;
  width:     number | null;
  height:    number | null;
}

// ---------------------------------------------------------------------------
// Batch session — persisted to localStorage
// ---------------------------------------------------------------------------

export interface BatchSessionTask {
  task_id:  string;
  image_id: string;
}

export interface BatchSession {
  tasks:     BatchSessionTask[];
  prompt:    string;
  startedAt: number;   // Date.now() timestamp
}