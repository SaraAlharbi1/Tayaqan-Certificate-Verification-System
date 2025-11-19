/**
 * lib/auth.ts
 * High-level authentication helpers.
 */

import { api } from "./api";
import {
  setAccessToken,
  setRefreshToken,
  clearTokens,
  getAccessToken,
} from "./storage";

import type { Tokens, MeResponse } from "./types";

/** Backend login expects: identifier + password */
export async function login(identifier: string, password: string): Promise<Tokens> {
  const tokens = await api<Tokens>("/accounts/auth/login/", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  setAccessToken(tokens.access);
  setRefreshToken(tokens.refresh);

  return tokens;
}

export function logout(): void {
  clearTokens();
  localStorage.removeItem("profile");
  localStorage.removeItem("user");
}

export function getAuthToken(): string | null {
  return getAccessToken();
}

export async function me(): Promise<MeResponse> {
  return api<MeResponse>("/accounts/auth/me/");
}

/**
 * Get cached profile from localStorage
 */
export function getProfile(): MeResponse | null {
  try {
    const data = localStorage.getItem("profile");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/**
 * Get wallet address from cached profile
 */
export function getWalletAddress(): string | null {
  const profile = getProfile();
  
  if (!profile) return null;
  
  if (profile.profile && typeof profile.profile === 'object' && 'wallet_address' in profile.profile) {
    return (profile.profile as any).wallet_address || null;
  }
  
  return null;
}

/**
 * Get contract address for institutions
 */
export function getContractAddress(): string | null {
  const profile = getProfile();
  
  if (!profile || profile.role !== 'INSTITUTION') return null;
  
  if (profile.profile && typeof profile.profile === 'object' && 'contract_address' in profile.profile) {
    return (profile.profile as any).contract_address || null;
  }
  
  return null;
}

/**
 * Get institution ID
 */
export function getInstitutionId(): string | null {
  const profile = getProfile();
  
  if (!profile || profile.role !== 'INSTITUTION') return null;
  
  if (profile.profile && typeof profile.profile === 'object' && 'institution_id' in profile.profile) {
    return (profile.profile as any).institution_id || null;
  }
  
  return null;
}