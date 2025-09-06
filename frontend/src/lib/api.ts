/**
 * Fetch wrapper:
 * - Adds JSON headers + Authorization (access token)
 * - Sends cookies for refresh flow with `credentials: 'include'`
 * - On 401, calls /auth/refresh once, stores new access token, and retries
 */

import { getAccessToken, setAccessToken, clearAccessToken } from "./storage";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

let refreshInFlight: Promise<string | null> | null = null;

/** Ask the backend to mint a new access token (refresh cookie is sent automatically). */
async function refreshAccessToken(): Promise<string | null> {
  const resp = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include", // send httpOnly cookie
  });
  if (!resp.ok) return null;

  const data = (await resp.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return data.accessToken;
}

/** Core API helper with auto-refresh + retry logic. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include", // include cookies for refresh flow
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (res.ok) return res.json() as Promise<T>;

  // Access token may be expired -> try to refresh once
  if (res.status === 401) {
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken().finally(() => (refreshInFlight = null));
    }
    const newToken = await refreshInFlight;

    if (newToken) {
      const retry = await fetch(`${BASE_URL}${path}`, {
        ...init,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${newToken}`,
          ...(init.headers || {}),
        },
      });
      if (retry.ok) return retry.json() as Promise<T>;
    }

    // Refresh failed → clear token; caller can redirect to /login
    clearAccessToken();
  }

  const text = await res.text().catch(() => "");
  throw new Error(text || res.statusText);
}
