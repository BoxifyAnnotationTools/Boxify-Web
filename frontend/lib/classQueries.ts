import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient as api } from "./api";
import { ProjectClass, ProjectClassCreate, ProjectClassUpdate } from "./types";

// Fetchers
export const getProjectClasses = async (
  projectId: number,
): Promise<ProjectClass[]> => {
  const { data } = await api.get(`/projects/${projectId}/classes`);
  return data.classes;
};

export const createProjectClass = async (
  projectId: number,
  payload: ProjectClassCreate,
): Promise<ProjectClass> => {
  const { data } = await api.post(`/projects/${projectId}/classes`, payload);
  return data;
};

export const updateProjectClass = async (
  projectId: number,
  classId: number,
  payload: ProjectClassUpdate,
): Promise<ProjectClass> => {
  const { data } = await api.put(
    `/projects/${projectId}/classes/${classId}`,
    payload,
  );
  return data;
};

export const deleteProjectClass = async (
  projectId: number,
  classId: number,
): Promise<{ message: string }> => {
  const { data } = await api.delete(
    `/projects/${projectId}/classes/${classId}`,
  );
  return data;
};

// Hooks
export const useClassesQuery = (projectId: number) => {
  return useQuery({
    queryKey: ["classes", projectId],
    queryFn: () => getProjectClasses(projectId),
    enabled: !!projectId,
  });
};

export const useCreateClassMutation = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProjectClassCreate) =>
      createProjectClass(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", projectId] });
    },
  });
};

export const useUpdateClassMutation = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      classId,
      payload,
    }: {
      classId: number;
      payload: ProjectClassUpdate;
    }) => updateProjectClass(projectId, classId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", projectId] });
      queryClient.invalidateQueries({
        queryKey: ["annotations", String(projectId)],
      });
    },
  });
};

export const useDeleteClassMutation = (projectId: number) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (classId: number) => deleteProjectClass(projectId, classId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", projectId] });
      queryClient.invalidateQueries({ queryKey: ["annotations"] });
      queryClient.invalidateQueries({ queryKey: ["images"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};
