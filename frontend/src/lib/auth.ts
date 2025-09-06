/**
 * High-level auth helpers.
 * - login(): POST /auth/login, stores access token (refresh cookie set by server)
 * - logout(): POST /auth/logout, clears local access token + server cookie
 * - getAuthToken(): convenience getter for guards
 */

import { api } from "./api";
import { setAccessToken, clearAccessToken, getAccessToken } from "./storage";
import type { AuthResponse, User } from "./types";

export async function login(email: string, password: string): Promise<User> {
  const res = await api<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // Backend sets httpOnly refresh cookie; we only persist the access token here.
  setAccessToken(res.accessToken);
  return res.user;
}

export async function logout(): Promise<void> {
  clearAccessToken();
  // Ask backend to clear the refresh cookie; ignore network errors on purpose
  try {
    await api<void>("/auth/logout", { method: "POST" });
  } catch {}
}

export function getAuthToken(): string | null {
  return getAccessToken();
}
