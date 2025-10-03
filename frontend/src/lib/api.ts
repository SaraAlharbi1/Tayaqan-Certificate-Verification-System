/** lib/api.ts */
import { getAccessToken, setAccessToken, getRefreshToken, clearTokens } from "./storage";

const BASE_URL = "http://127.0.0.1:8000/api";
let refreshInFlight: Promise<string | null> | null = null;

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
  if (!(init.body instanceof FormData)) h["Content-Type"] = "application/json";
  if (access) h["Authorization"] = `Bearer ${access}`;
  if (init.headers) Object.assign(h, init.headers as Record<string, string>);
  return h;
}

async function parseJsonSafe(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (res.status === 204 || !ct.includes("application/json")) return null;
  try { return await res.json(); } catch { return null; }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const access = getAccessToken() || undefined;
  const doFetch = (token?: string) =>
    fetch(`${BASE_URL}${path}`, { ...init, headers: buildHeaders(init, token) });

  let res = await doFetch(access);
  if (res.ok) {
    const data = await parseJsonSafe(res);
    return (data ?? (undefined as unknown)) as T;
  }

  if (res.status === 401) {
    if (!refreshInFlight) refreshInFlight = refreshAccessToken().finally(() => (refreshInFlight = null));
    const newAccess = await refreshInFlight;
    if (newAccess) {
      const retry = await doFetch(newAccess);
      if (retry.ok) {
        const data = await parseJsonSafe(retry);
        return (data ?? (undefined as unknown)) as T;
      }
    }
    clearTokens();
  }

  // Normalize error so UI can read err.response.data.detail, etc.
  const text = await res.text().catch(() => "");
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  throw {
    response: { status: res.status, data },
    message: data?.detail || text || res.statusText,
  } as any;
}
