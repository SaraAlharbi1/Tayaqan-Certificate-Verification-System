/**
 * Local storage for access/refresh tokens (no cookies).
 */
let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

const KEY_ACCESS = "tayaqan:access";
const KEY_REFRESH = "tayaqan:refresh";

export function getAccessToken(): string | null {
  return memoryAccessToken ?? localStorage.getItem(KEY_ACCESS);
}
export function setAccessToken(token: string) {
  memoryAccessToken = token; localStorage.setItem(KEY_ACCESS, token);
}
export function getRefreshToken(): string | null {
  return memoryRefreshToken ?? localStorage.getItem(KEY_REFRESH);
}
export function setRefreshToken(token: string) {
  memoryRefreshToken = token; localStorage.setItem(KEY_REFRESH, token);
}
export function clearTokens() {
  memoryAccessToken = null; memoryRefreshToken = null;
  localStorage.removeItem(KEY_ACCESS); localStorage.removeItem(KEY_REFRESH);
}
