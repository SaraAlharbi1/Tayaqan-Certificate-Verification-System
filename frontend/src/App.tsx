import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./App/layout/PublicLayout";

// Public pages
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutUsPage";
import HowItWorksPage from "./pages/HowItWorksPage";

// Auth
import LoginPage from "./pages/auth/LoginPage";
import SignupSelectionPage from "./pages/auth/SignupSelectionPage";

// Employer role
import AccessRequests from "./Pages/EmployerRole/AccessRequests";
import CreateAccessRequest from "./Pages/EmployerRole/CreateAccessRequest";
import ApplicantSharedCertificates from "./Pages/EmployerRole/ApplicantSharedCertificates";
import CertificateDetailsPage from "./Pages/EmployerRole/CertificateDetails";

// Applicant role
import ApplicantPage from "./Pages/ApplicantRole/ApplicantPage";
import MyCertificatesPage from "./Pages/ApplicantRole/MyCertificatesPage";
import AccessReqused from "./Pages/ApplicantRole/AccessReqused";
import AccessCertificates from "./Pages/ApplicantRole/AccessCertificates";

export default function App() {
  return (
    <PublicLayout>
      <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Applicant */}
        <Route path="/ApplicantPage" element={<ApplicantPage />} />
        <Route path="/applicant/certificates" element={<MyCertificatesPage />} />
        <Route path="/applicant/requests" element={<AccessReqused />} />
        <Route path="/applicant/requests/:requestId" element={<AccessCertificates />} />

        {/* Employer */}
        <Route path="/AccessRequests" element={<AccessRequests />} />
        <Route path="/employer/access/new" element={<CreateAccessRequest />} />
        <Route path="/employer/applicants/:applicantId/shared" element={<ApplicantSharedCertificates />} />
        <Route path="/employer/certificates/:certificateId" element={<CertificateDetailsPage />} />

        {/* Signup */}
        <Route path="/signup" element={<SignupSelectionPage />} />
        <Route path="/signup/applicant" element={<div>Applicant Signup TODO</div>} />
        <Route path="/signup/institution" element={<div>Institution Signup TODO</div>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PublicLayout>
  );
}
