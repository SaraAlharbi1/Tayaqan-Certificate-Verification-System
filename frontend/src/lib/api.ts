/**
 * lib/api.ts
 * Production-ready API helper with JWT auto-refresh.
 */

import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
} from "./storage";

/** Auto-detect backend URL */
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (location.hostname === "localhost"
    ? "http://127.0.0.1:8000/api"
    : "https://your-production-domain.com/api");

let refreshInFlight: Promise<string | null> | null = null;

export type ApiError = Error & {
  status: number;
  code?: string;
  userMessage?: string;
  detail?: any;
  data?: any;
  response: { status: number; data: any };
};

/* ------------------ REFRESH LOGIC ------------------ */

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${BASE_URL}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { access: string; refresh?: string };
  setAccessToken(data.access);
  if (data.refresh) setRefreshToken(data.refresh);

  return data.access;
}

/* ------------------ HELPERS ------------------ */

function buildHeaders(init: RequestInit, access?: string) {
  const h: Record<string, string> = {};
  if (!(init.body instanceof FormData)) h["Content-Type"] = "application/json";
  if (access) h["Authorization"] = `Bearer ${access}`;
  if (init.headers) Object.assign(h, init.headers as Record<string, string>);
  return h;
}

async function parseJsonSafe(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (res.status === 204 || !ct.includes("application/json")) return null;

  try {
    return await res.json();
  } catch {
    return null;
  }
}

function buildApiError(res: Response, data: any, text: string): ApiError {
  const err = new Error(
    data?.user_message || data?.detail || data?.error || text || res.statusText
  ) as ApiError;

  err.status = res.status;
  err.code = data?.code;
  err.userMessage =
    data?.user_message || data?.detail || data?.error || text || "Request failed";
  err.detail = data?.detail;
  err.data = data;
  err.response = { status: res.status, data };

  return err;
}

/* ------------------ MAIN JSON API ------------------ */

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const access = getAccessToken() || undefined;

  const doFetch = (token?: string) =>
    fetch(`${BASE_URL}${path}`, { ...init, headers: buildHeaders(init, token) });

  let res = await doFetch(access);

  if (res.ok) return (await parseJsonSafe(res)) as T;

  /* Auto-refresh JWT */
  if (res.status === 401) {
    if (!refreshInFlight)
      refreshInFlight = refreshAccessToken().finally(() => (refreshInFlight = null));

    const newAccess = await refreshInFlight;

    if (newAccess) {
      const retry = await doFetch(newAccess);
      if (retry.ok) return (await parseJsonSafe(retry)) as T;

      const retryText = await retry.text().catch(() => "");
      let retryJson: any = null;
      try {
        retryJson = retryText ? JSON.parse(retryText) : null;
      } catch {}
      throw buildApiError(retry, retryJson, retryText);
    }

    clearTokens();
  }

  /* Final error */
  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  throw buildApiError(res, data, text);
}

/* ------------------ FILE DOWNLOAD API ------------------ */

export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const access = getAccessToken() || undefined;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: buildHeaders(init, access),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to load file");
  }

  return res.blob();
}
