import type { MeResponse, ApplicantProfile, InstitutionProfile } from "./types";

/**
 * Get cached profile from localStorage
 */
export function getCachedProfile(): MeResponse | null {
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
  const profile = getCachedProfile();
  
  if (!profile) return null;
  
  // Check if profile has wallet_address
  if (profile.profile && typeof profile.profile === 'object' && 'wallet_address' in profile.profile) {
    return (profile.profile as any).wallet_address || null;
  }
  
  return null;
}

/**
 * Get contract address for institutions
 */
export function getContractAddress(): string | null {
  const profile = getCachedProfile();
  
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
  const profile = getCachedProfile();
  
  if (!profile || profile.role !== 'INSTITUTION') return null;
  
  if (profile.profile && typeof profile.profile === 'object' && 'institution_id' in profile.profile) {
    return (profile.profile as any).institution_id || null;
  }
  
  return null;
}