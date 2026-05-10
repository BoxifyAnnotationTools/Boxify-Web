import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "./types";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

// Helper: write/clear the cookie that middleware.ts reads on the Edge
function setAuthCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    // 7-day expiry — adjust to match your JWT TTL
    const expires = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toUTCString();
    document.cookie = `boxify-auth-token=${token}; path=/; expires=${expires}; SameSite=Lax`;
  } else {
    // Clear cookie
    document.cookie = "boxify-auth-token=; path=/; max-age=0; SameSite=Lax";
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) => {
        setAuthCookie(token);
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        setAuthCookie(null);
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: "boxify-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
