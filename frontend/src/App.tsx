// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./App/layout/PublicLayout";
import ProtectedRoute from "./lib/ProtectedRoute";

/* ---------- Public pages ---------- */
import HomePage from "./Pages/HomePage";
import AboutPage from "./Pages/AboutUsPage";
import HowItWorksPage from "./Pages/HowItWorksPage";

/* ---------- Auth ---------- */
import LoginPage from "./Pages/auth/LoginPage";
import SignupSelectionPage from "./Pages/auth/SignupSelectionPage";
import SignupInstitution from "./Pages/auth/SignupInstitution";
import SuccessPending from "./Pages/auth/SuccessPending";
import SignupApplicant from "./Pages/auth/SignupApplicant";
import SignupEmployer from "./Pages/auth/SignupEmployer";

/* ---------- Password reset ---------- */
import RequestResetPage from "./Pages/auth/RequestResetPage";
import ResetPasswordPage from "./Pages/auth/ResetPassword";

/* ---------- Employer role ---------- */
import EmployerHome from "./Pages/EmployerRole/EmployerHome";
import AccessRequests from "./Pages/EmployerRole/AccessRequests";
import CreateAccessRequest from "./Pages/EmployerRole/CreateAccessRequest";
import ApplicantSharedCertificates from "./Pages/EmployerRole/ApplicantSharedCertificates";
import CertificateDetailsPage from "./Pages/EmployerRole/CertificateDetails";

/* ---------- Applicant role ---------- */
import ApplicantHome from "./Pages/ApplicantRole/ApplicantHome";
import MyCertificatesPage from "./Pages/ApplicantRole/MyCertificatesPage";
import AccessRequestsApplicant from "./Pages/ApplicantRole/AccessRequests";
import AccessCertificates from "./Pages/ApplicantRole/AccessCertificates";
import MyApplicantCertificateDetails from "./Pages/ApplicantRole/MyApplicantCertificateDetails"; // <-- ADD

/* ---------- Institution role ---------- */
import UploadCertificate from "./Pages/InstitutionRole/UploadCertificate";
import UploadSuccess from "./Pages/InstitutionRole/UploadSuccess";
import InstitutionHome from "./Pages/InstitutionRole/InstitutionHome";
import IssuedCertificates from "./Pages/InstitutionRole/IssuedCertificates";
import InstitutionCertificateDetails from "./Pages/InstitutionRole/InstitutionCertificateDetails";

/* ---------- Role-based guard ---------- */
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
        {/* ---------- Public ---------- */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* ---------- Password reset (public) ---------- */}
        <Route path="/forgot-password" element={<RequestResetPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* ---------- Signup (public) ---------- */}
        <Route path="/signup" element={<SignupSelectionPage />} />
        <Route path="/signup/applicant" element={<SignupApplicant />} />
        <Route path="/signup/employer" element={<SignupEmployer />} />
        <Route path="/signup/institution" element={<SignupInstitution />} />
        <Route path="/signup/success/:role" element={<SuccessPending />} />

        {/* ---------- Applicant ---------- */}
        <Route
          path="/applicant"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["applicant"]}>
                <ApplicantHome />
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
          path="/applicant/certificates/:id" // <-- ADD
          element={
            <ProtectedRoute>
              <RoleRoute allow={["applicant"]}>
                <MyApplicantCertificateDetails />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applicant/requests"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["applicant"]}>
                <AccessRequestsApplicant />
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

        {/* ---------- Employer ---------- */}
        <Route
          path="/employer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}>
                <EmployerHome />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer/access"
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
          path="/employer/applicants/:applicantId/shared"
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

        {/* ---------- Institution ---------- */}
        <Route
          path="/institution"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["institution"]}>
                <InstitutionHome />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
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
          path="/institution/certificates"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["institution"]}>
                <IssuedCertificates />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/institution/certificates/:id"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["institution"]}>
                <InstitutionCertificateDetails />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* ---------- Fallback ---------- */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PublicLayout>
  );
}
