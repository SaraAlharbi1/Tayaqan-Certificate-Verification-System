/** lib/api.ts */
import { getAccessToken, setAccessToken, getRefreshToken, clearTokens } from "./storage";

const BASE_URL = "http://127.0.0.1:8000/api";
let refreshInFlight: Promise<string | null> | null = null;

export type ApiError = Error & {
  status: number;
  code?: string;
  userMessage?: string;
  detail?: any;
  data?: any;
  response: { status: number; data: any }; 
};

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const resp = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!resp.ok) return null;

  const data = (await resp.json()) as { access: string };
  setAccessToken(data.access);
  return data.access;
}

function buildHeaders(init: RequestInit, access?: string) {
  const h: Record<string, string> = {};
  // Only set JSON content-type when NOT sending FormData
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

function buildApiError(res: Response, data: any, fallbackText: string): ApiError {
  const code = data?.code ?? data?.error;
  const userMessage =
    data?.user_message ?? data?.detail ?? data?.error ?? fallbackText ?? res.statusText;

  const err = new Error(userMessage) as ApiError;
  err.status = res.status;
  err.code = code;
  err.userMessage = userMessage;
  err.detail = data?.detail ?? undefined;
  err.data = data;
  err.response = { status: res.status, data };
  return err;
}

/** JSON-first helper (existing behavior). */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const access = getAccessToken() || undefined;
  const doFetch = (token?: string) =>
    fetch(`${BASE_URL}${path}`, { ...init, headers: buildHeaders(init, token) });

  // 1st attempt
  let res = await doFetch(access);
  if (res.ok) {
    const data = await parseJsonSafe(res);
    return (data ?? (undefined as unknown)) as T;
  }

  // Refresh on 401 and retry once
  if (res.status === 401) {
    if (!refreshInFlight)
      refreshInFlight = refreshAccessToken().finally(() => (refreshInFlight = null));
    const newAccess = await refreshInFlight;
    if (newAccess) {
      const retry = await doFetch(newAccess);
      if (retry.ok) {
        const data = await parseJsonSafe(retry);
        return (data ?? (undefined as unknown)) as T;
      }
      const retryText = await retry.text().catch(() => "");
      let retryData: any = null;
      try {
        retryData = retryText ? JSON.parse(retryText) : null;
      } catch {}
      throw buildApiError(retry, retryData, retryText);
    }
    clearTokens();
  }

  // Normalize error
  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  throw buildApiError(res, data, text);
}

/** Raw fetch with same auth + auto-refresh (use for non-JSON). */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const access = getAccessToken() || undefined;
  const doFetch = (token?: string) =>
    fetch(`${BASE_URL}${path}`, { ...init, headers: buildHeaders(init, token) });

  // 1st attempt
  let res = await doFetch(access);
  if (res.ok) return res;

  // Refresh on 401 and retry once
  if (res.status === 401) {
    if (!refreshInFlight)
      refreshInFlight = refreshAccessToken().finally(() => (refreshInFlight = null));
    const newAccess = await refreshInFlight;
    if (newAccess) {
      const retry = await doFetch(newAccess);
      if (retry.ok) return retry;

      const retryText = await retry.text().catch(() => "");
      let retryData: any = null;
      try {
        retryData = retryText ? JSON.parse(retryText) : null;
      } catch {}
      throw buildApiError(retry, retryData, retryText);
    }
    clearTokens();
  }

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  throw buildApiError(res, data, text);
}

/** Convenience wrapper for blobs (PDFs, images, etc.). */
export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const res = await apiFetch(path, init);
  return res.blob();
}
