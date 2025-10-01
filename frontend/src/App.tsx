// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./App/layout/PublicLayout";
import ProtectedRoute from "./lib/ProtectedRoute";

// Public pages
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutUsPage";
import HowItWorksPage from "./pages/HowItWorksPage";

// Auth
import LoginPage from "./pages/auth/LoginPage";
import SignupSelectionPage from "./pages/auth/SignupSelectionPage";
import SignupInstitution from "./pages/auth/SignupInstitution";
import SuccessPending from "./pages/auth/SuccessPending";
import SignupApplicant from "./Pages/auth/SignupApplicant";
import SignupEmployer from "./Pages/auth/SignupEmployer";

//  Password reset
import RequestResetPage from "./pages/auth/RequestResetPage";
import ResetPasswordPage from "./pages/auth/ResetPassword";

// Employer role
import AccessRequests from "./Pages/EmployerRole/EmployerDashboard";
import CreateAccessRequest from "./Pages/EmployerRole/CreateAccessRequest";
import ApplicantSharedCertificates from "./Pages/EmployerRole/ApplicantSharedCertificates";
import CertificateDetailsPage from "./Pages/EmployerRole/CertificateDetails";

// Applicant role
import ApplicantPage from "./Pages/ApplicantRole/ApplicantDashboard";
import MyCertificatesPage from "./Pages/ApplicantRole/MyCertificatesPage";
import AccessReqused from "./Pages/ApplicantRole/AccessReqused";
import AccessCertificates from "./Pages/ApplicantRole/AccessCertificates";


// Institution role
import UploadCertificate from "./Pages/InstitutionRole/UploadCertificate";
import UploadSuccess from "./Pages/InstitutionRole/UploadSuccess";
import InstitutionDashboard from "./Pages/InstitutionRole/InstitutionDashboard";

// ---- Role-based guard ----
function RoleRoute({
  children,
  allow,
}: {
  children: JSX.Element;
  allow: Array<"institution" | "employer" | "applicant">;
}) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const role = (user?.role || "").toLowerCase();
  const allowSet = new Set(allow.map((r) => r.toLowerCase()));
  if (!role || !allowSet.has(role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <PublicLayout>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* 🔹 Password reset (public) */}
        <Route path="/forgot-password" element={<RequestResetPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Signup (public) */}
        <Route path="/signup" element={<SignupSelectionPage />} />
        <Route path="/signup/applicant" element={<SignupApplicant />} />
        <Route path="/signup/employer" element={<SignupEmployer />} />
        <Route path="/signup/institution" element={<SignupInstitution />} />
        <Route path="/signup/success/:role" element={<SuccessPending />} />

        {/* Applicant (protected + role) */}
        <Route
          path="/ApplicantDashboard"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["applicant"]}>
                <ApplicantPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applicant/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["applicant"]}>
                <MyCertificatesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applicant/requests"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["applicant"]}>
                <AccessReqused />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applicant/requests/:requestId"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["applicant"]}>
                <AccessCertificates />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Employer (protected + role) */}
        <Route
          path="/EmployerDashboard"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}>
                <AccessRequests />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/access/new"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}>
                <CreateAccessRequest />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/applicents/:applicantId/shared"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}>
                <ApplicantSharedCertificates />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/certificates/:certificateId"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}>
                <CertificateDetailsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Institution (protected + role) */}
        <Route
          path="/institution/upload"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["institution"]}>
                <UploadCertificate />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/institution/upload/success/:applicantId"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["institution"]}>
                <UploadSuccess />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/InstitutionDashboard"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["institution"]}>
                <InstitutionDashboard />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PublicLayout>
  );
}
