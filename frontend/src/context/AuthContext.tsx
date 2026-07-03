import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, refreshAccessToken, setAccessToken } from "../api/client";

export interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
}

interface AuthContextValue {
  user: User | null;
  // True only during the initial-mount silent refresh — lets ProtectedRoute
  // avoid bouncing straight to /login before we know whether the httpOnly
  // refresh cookie is actually valid.
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function silentLogin() {
      // /auth/refresh only returns a new accessToken, not the user — fetch
      // /auth/me separately to rehydrate who's logged in.
      const token = await refreshAccessToken();
      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const { user: refreshedUser } = await apiFetch<{ user: User }>("/auth/me");
        if (!cancelled) setUser(refreshedUser);
      } catch {
        setAccessToken(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void silentLogin();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    const data = await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password },
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      // Always clear local state even if the network call fails — staying
      // "logged in" client-side because a logout request failed is worse.
      setAccessToken(null);
      setUser(null);
    }
  }

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
