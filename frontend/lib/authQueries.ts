"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { login, register } from "./api";
import { useAuthStore } from "./authStore";
import type { AuthLoginRequest, AuthRegisterRequest } from "./types";

// ── Login mutation ──

export function useLoginMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (credentials: AuthLoginRequest) => login(credentials),
    onSuccess: (data) => {
      queryClient.clear();
      setAuth(data.access_token, {
        id: data.user_id,
        username: data.username,
      });
      router.push("/dashboard");
    },
  });
}

// ── Register mutation ──

export function useRegisterMutation() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  return useMutation({
    mutationFn: (credentials: AuthRegisterRequest) => register(credentials),
    onSuccess: (data) => {
      setAuth(data.access_token, {
        id: data.user_id,
        username: data.username,
      });
      router.push("/dashboard");
    },
  });
}
