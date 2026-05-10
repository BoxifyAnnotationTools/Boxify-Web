import axios from "axios";
import type {
  ImageListResponse,
  BackendImageItem,
  AnnotationRequest,
  AnnotationResponse,
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthResponse,
  ProjectListResponse,
  ProjectCreateResponse,
  ProjectListItem
} from "./types";

// ── Axios instance ──
export const API_BASE =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000/api`
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: API_BASE,
});

// ── Request interceptor: attach JWT if present ──
// We import lazily to avoid circular deps & SSR issues with localStorage
apiClient.interceptors.request.use((config) => {
  // Dynamically require the store only on the client
  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("./authStore");
    const token: string | null = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: auto-logout on 401 ──
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useAuthStore } = require("./authStore");
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// ── Auth Fetchers ──

/** POST /api/auth/login → receive JWT token */
export async function login(
  credentials: AuthLoginRequest,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    "/auth/login",
    credentials,
  );
  return data;
}

/** POST /api/auth/register → create account + receive JWT token */
export async function register(
  credentials: AuthRegisterRequest,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    "/auth/register",
    credentials,
  );
  return data;
}

// ── Project Fetchers ──

/** GET /api/projects → list user projects */
export async function getProjects(): Promise<ProjectListResponse> {
  const { data } = await apiClient.get<ProjectListResponse>("/projects");
  return data;
}

/**
 * POST /api/projects → create a new project with a ZIP upload.
 * Axios automatically sets Content-Type: multipart/form-data when
 * the body is a FormData instance.
 */
export async function createProject(
  formData: FormData,
): Promise<ProjectCreateResponse> {
  const { data } = await apiClient.post<ProjectCreateResponse>(
    "/projects",
    formData,
  );
  return data;
}

// ── Image Fetchers ──

/** GET /api/projects/{projectId}/images → list of image objects */
export async function getImages(
  projectId: string,
): Promise<BackendImageItem[]> {
  const { data } = await apiClient.get<ImageListResponse>(
    `/projects/${projectId}/images`,
  );
  return data.images;
}

/** POST /api/projects/{projectId}/annotations/{filename} → save bounding boxes */
export async function saveAnnotations(
  projectId: string,
  filename: string,
  payload: AnnotationRequest,
): Promise<AnnotationResponse> {
  const { data } = await apiClient.post<AnnotationResponse>(
    `/projects/${projectId}/annotations/${encodeURIComponent(filename)}`,
    payload,
  );
  return data;
}

/** GET /api/projects/{projectId}/annotations/{filename} → load bounding boxes */
export async function getAnnotations(
  projectId: string,
  filename: string,
): Promise<AnnotationRequest> {
  const { data } = await apiClient.get<AnnotationRequest>(
    `/projects/${projectId}/annotations/${encodeURIComponent(filename)}`,
  );
  return data;
}

/** GET /api/projects/{projectId}/export → download zip as Blob */
export async function exportDataset(projectId: string): Promise<Blob> {
  const { data } = await apiClient.get(`/projects/${projectId}/export`, {
    responseType: "blob",
  });
  return data;
}

/** DELETE /api/projects/{projectId}/images/{filename} → delete an image */
export async function deleteImage(
  projectId: string,
  filename: string,
): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(
    `/projects/${projectId}/images/${encodeURIComponent(filename)}`,
  );
  return data;
}

/** PATCH /api/projects/{id} -> Update nama project */
export async function updateProject(id: number, name: string): Promise<ProjectListItem> {
  const { data } = await apiClient.patch<ProjectListItem>(`/projects/${id}`, { name });
  return data;
}

/** DELETE /api/projects/{id} -> Hapus project secara permanen */
export async function deleteProject(id: number): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${id}`);
  return data;
}

/** POST /api/projects/{projectId}/models → upload a model */
export async function uploadModel(
  projectId: string,
  formData: FormData,
): Promise<{ message: string; model_name: string }> {
  const { data } = await apiClient.post<{
    message: string;
    model_name: string;
  }>(`/projects/${projectId}/models`, formData);
  return data;
}

/** GET /api/projects/{projectId}/models → list saved models */
export async function getModels(
  projectId: string,
): Promise<{ id: number; name: string; uploaded_at: string }[]> {
  const { data } = await apiClient.get<{
    models: { id: number; name: string; uploaded_at: string }[];
  }>(`/projects/${projectId}/models`);
  return data.models;
}

/** POST /api/projects/{projectId}/images/{filename}/auto-label → auto label image */
export async function autoLabelImage(
  projectId: string,
  filename: string,
  payload: { model_name: string },
): Promise<{ message: string; boxes_added: number; classes_created: number }> {
  const { data } = await apiClient.post<{
    message: string;
    boxes_added: number;
    classes_created: number;
  }>(
    `/projects/${projectId}/images/${encodeURIComponent(filename)}/auto-label`,
    payload,
  );
  return data;
}
