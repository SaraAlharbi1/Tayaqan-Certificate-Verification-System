/**
 * High-level auth helpers (header JWT).
 */
import { api } from "./api";
import { setAccessToken, setRefreshToken, clearTokens, getAccessToken } from "./storage";
import type { Tokens, MeResponse } from "./types";

/** Login with email OR national ID (use "identifier") */
export async function login(identifier: string, password: string): Promise<Tokens> {
  const tokens = await api<Tokens>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  setAccessToken(tokens.access);
  setRefreshToken(tokens.refresh);
  return tokens;
}

export function logout(): void {
  clearTokens(); // no server logout endpoint (stateless JWT)
}

/** Convenience getter for guards */
export function getAuthToken(): string | null {
  return getAccessToken();
}

/** Fetch current user profile */
export async function me(): Promise<MeResponse> {
  return api<MeResponse>("/me/");
}
