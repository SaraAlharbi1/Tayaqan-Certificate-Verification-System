/**
 * Route guard for protected pages.
 *
 * - Checks for a valid access token via getAuthToken().
 * - If absent, redirects to /login and stores the current
 *   location in state.from so login can redirect back.
 *
 * Usage:
 *   <Route path="/dashboard" element={
 *     <ProtectedRoute><DashboardPage /></ProtectedRoute>
 *   } />
 */
import { Navigate, useLocation } from "react-router-dom";
import { getAuthToken } from "./auth";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = getAuthToken();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
