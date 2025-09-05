/**
 * Route guard for pages that require authentication.
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
    // Preserve where the user wanted to go
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
