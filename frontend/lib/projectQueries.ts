"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getProjects, createProject, updateProject, deleteProject } from "./api";
import { useAuthStore } from "./authStore";

// ── Query: fetch user's project list ──

export function useProjectsQuery() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ["projects", user?.id],
    queryFn: () => getProjects(),
    enabled: isAuthenticated && !!user?.id,
  });
}

// ── Mutation: create a new project via ZIP upload ──

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => createProject(formData),
    onSuccess: () => {
      // Invalidate the projects list so the dashboard refreshes automatically
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateProject(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
