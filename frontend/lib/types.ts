// ── Frontend domain types ──

export interface Annotation {
  id: string;
  type?: "bbox" | "polygon";
  x: number;
  y: number;
  width: number;
  height: number;
  points?: { x: number; y: number }[];
  label: string;
  color: string;
}

export interface ImageItem {
  id: string;
  name: string;
  url: string;
  width: number;
  height: number;
  annotationCount: number;
}

export interface ClassLabel {
  name: string;
  color: string;
  shortcut: string;
}

export const CLASS_LABELS: ClassLabel[] = [
  { name: "Person", color: "#EF4444", shortcut: "1" },
  { name: "Car", color: "#3B82F6", shortcut: "2" },
  { name: "Dog", color: "#22C55E", shortcut: "3" },
  { name: "Cat", color: "#EAB308", shortcut: "4" },
  { name: "Bicycle", color: "#A855F7", shortcut: "5" },
  { name: "Traffic Light", color: "#F97316", shortcut: "6" },
  { name: "Truck", color: "#06B6D4", shortcut: "7" },
  { name: "Bus", color: "#EC4899", shortcut: "8" },
];

// ── API types (matching backend Pydantic schemas) ──

export interface BackendImageItem {
  filename: string;
  annotation_count: number;
}

export interface ImageListResponse {
  images: BackendImageItem[];
}

export interface BoundingBoxSchema {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type?: "bbox" | "polygon";
  points?: { x: number; y: number }[];
}

export interface AnnotationRequest {
  image_width: number;
  image_height: number;
  filename?: string;
  boxes: BoundingBoxSchema[];
}

export interface AnnotationResponse {
  message: string;
  label_file: string;
  box_count: number;
}

// ── Auth types (matching backend Pydantic schemas) ──

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthRegisterRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  username: string;
}

export interface AuthUser {
  id: number;
  username: string;
}

// ── Project types (matching backend Pydantic schemas) ──

export interface ProjectListItem {
  id: number;
  name: string;
  image_count: number;
  annotated_count: number;
  created_at: string; // ISO datetime string from backend
}

export interface ProjectListResponse {
  projects: ProjectListItem[];
}

export interface ProjectCreateResponse {
  id: number;
  name: string;
  image_count: number;
  created_at: string;
}

export interface ProjectClass {
  id: number;
  project_id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface ProjectClassCreate {
  name: string;
  color?: string;
}

export interface ProjectClassUpdate {
  name?: string;
  color?: string;
}
