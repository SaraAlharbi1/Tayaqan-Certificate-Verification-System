/**
 * Minimal client-side storage for the *access* token only.
 * The refresh token is stored by the server in an httpOnly cookie
 * (unreadable by JS) and sent automatically with `credentials: 'include'`.
 */

let memoryAccessToken: string | null = null; // fast + safest place
const KEY = "tayaqan:access";

/** Read the current access token (memory first, then localStorage). */
export function getAccessToken(): string | null {
  return memoryAccessToken ?? localStorage.getItem(KEY);
}

/** Save the current access token (both memory + localStorage for reloads). */
export function setAccessToken(token: string) {
  memoryAccessToken = token;
  localStorage.setItem(KEY, token);
}

/** Remove the access token everywhere. */
export function clearAccessToken() {
  memoryAccessToken = null;
  localStorage.removeItem(KEY);
}
