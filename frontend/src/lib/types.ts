/**
 * Shared TypeScript types used across the auth + API layer.
 */
export type User = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  /** Short-lived JWT used in the Authorization header */
  accessToken: string;
  /** The authenticated user profile */
  user: User;
};
