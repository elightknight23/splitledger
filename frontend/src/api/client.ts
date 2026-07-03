const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// The access token lives only in this module-level variable — never
// localStorage/sessionStorage, so it can't be read by an XSS payload and
// disappears on every full page reload. AuthContext is the only thing that
// calls setAccessToken; everything else just calls apiFetch.
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    // Required so the httpOnly refresh cookie is sent on /auth/refresh (and
    // received via Set-Cookie on /auth/login and /auth/register).
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && typeof data === "object" && "error" in data && data.error) || res.statusText;
    throw new ApiError(res.status, String(message));
  }
  return data as T;
}

// Used only for the initial-mount silent login. A 401 here just means there's
// no valid session (logged out, or the refresh cookie expired/was never set)
// — not an error worth surfacing.
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const { accessToken: token } = await apiFetch<{ accessToken: string }>("/auth/refresh", {
      method: "POST",
    });
    setAccessToken(token);
    return token;
  } catch {
    setAccessToken(null);
    return null;
  }
}
