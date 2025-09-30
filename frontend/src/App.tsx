// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./App/layout/PublicLayout";

// Public
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutUsPage";
import HowItWorksPage from "./pages/HowItWorksPage";

// Auth
import LoginPage from "./pages/auth/LoginPage";
import SignupSelectionPage from "./pages/auth/SignupSelectionPage";
import SignupInstitution from "./pages/auth/SignupInstitution";
import SuccessPending from "./pages/auth/SuccessPending";

// Employer
import AccessRequests from "./Pages/EmployerRole/AccessRequests";
import CreateAccessRequest from "./Pages/EmployerRole/CreateAccessRequest";
import ApplicantSharedCertificates from "./Pages/EmployerRole/ApplicantSharedCertificates";
import CertificateDetailsPage from "./Pages/EmployerRole/CertificateDetails";

// Applicant
import ApplicantPage from "./Pages/ApplicantRole/ApplicantPage";
import MyCertificatesPage from "./Pages/ApplicantRole/MyCertificatesPage";
import AccessReqused from "./Pages/ApplicantRole/AccessReqused";
import AccessCertificates from "./Pages/ApplicantRole/AccessCertificates";

// Employer/Applicant signup pages (if present)
import SignupApplicant from "./Pages/auth/SignupApplicant";
import SignupEmployer from "./Pages/auth/SignupEmployer";

// Institution
import UploadCertificate from "./Pages/InstitutionRole/UploadCertificate";
import UploadSuccess from "./Pages/InstitutionRole/UploadSuccess";
import InstitutionDashboard from "./Pages/InstitutionRole/InstitutionDashboard";

// --- helpers (same logic as in Navbar) ---
type Role = "public" | "institution" | "employer" | "applicant";
const normalizeRole = (r?: string): Role => {
  const s = (r || "").toLowerCase();
  if (s.includes("institution")) return "institution";
  if (s.includes("employer") || s.includes("hr")) return "employer";
  if (s.includes("applicant") || s.includes("student")) return "applicant";
  return "public";
};

// default first-link per role (keep in sync with your Navbar LINKS)
const defaultPathForRole = (role: Role) => {
  switch (role) {
    case "institution":
      return "/institution/dashboard";
    case "employer":
      return "/employer/access-requests";
    case "applicant":
      return "/applicant"; // or "/applicant/certificates"
    default:
      return "/public-home";
  }
};

// smart root: public home if no role; else redirect to role’s first tab
function RootSmart() {
  let role: Role = "public";
  try {
    const u = JSON.parse(localStorage.getItem("user") || "{}");
    role = normalizeRole(u?.role);
  } catch {}
  if (role === "public") return <HomePage />;
  return <Navigate to={defaultPathForRole(role)} replace />;
}

export default function App() {
  return (
    <PublicLayout>
      <Routes>
        {/* SMART ROOT */}
        <Route path="/" element={<RootSmart />} />

        {/* Public */}
        <Route path="/public-home" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Applicant */}
        <Route path="/applicant" element={<ApplicantPage />} />
        <Route path="/applicant/certificates" element={<MyCertificatesPage />} />
        <Route path="/applicant/requests" element={<AccessReqused />} />
        <Route path="/applicant/requests/:requestId" element={<AccessCertificates />} />

        {/* Employer — canonical lowercase paths */}
        <Route path="/employer/access-requests" element={<AccessRequests />} />
        <Route path="/employer/access/new" element={<CreateAccessRequest />} />
        <Route
          path="/employer/applicants/:applicantId/shared"
          element={<ApplicantSharedCertificates />}
        />
        <Route
          path="/employer/certificates/:certificateId"
          element={<CertificateDetailsPage />}
        />
        {/* legacy alias so old bookmarks still work */}
        <Route path="/AccessRequests" element={<Navigate to="/employer/access-requests" replace />} />

        {/* Signup */}
        <Route path="/signup" element={<SignupSelectionPage />} />
        <Route path="/signup/applicant" element={<SignupApplicant />} />
        <Route path="/signup/employer" element={<SignupEmployer />} />
        <Route path="/signup/institution" element={<SignupInstitution />} />
        <Route path="/signup/success/:role" element={<SuccessPending />} />

        {/* Institution */}
        <Route path="/institution/dashboard" element={<InstitutionDashboard />} />
        <Route path="/institution/upload" element={<UploadCertificate />} />
        <Route path="/institution/upload/success/:applicantId" element={<UploadSuccess />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PublicLayout>
  );
}
