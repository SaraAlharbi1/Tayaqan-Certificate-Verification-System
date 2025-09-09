import { Routes, Route, Navigate } from "react-router-dom";
import PublicLayout from "./App/layout/PublicLayout";
import HomePage from "./pages/HomePage";
import AboutPage from "./pages/AboutUsPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import LoginPage from "./pages/auth/LoginPage";
import SignupSelectionPage from "./pages/auth/SignupSelectionPage";
import SignupInstitution from "./pages/auth/SignupInstitution"; // Add this import
import SignupApplicant from "./Pages/auth/SignupApplicant";
import SignupEmployer from "./Pages/auth/SignupEmployer";
import SuccessPending from "@/pages/auth/SuccessPending";
//InstitutionRole
import UploadCertificate from "./Pages/InstitutionRole/UploadCertificate";
/**
 * App.tsx
 *
 * Main application entry point.
 * - Wraps all public routes inside `PublicLayout` (Navbar + Footer).
 * - Defines route structure using React Router v6.
 *
 * Routes:
 *   /                     → HomePage
 *   /about                → AboutUsPage
 *   /how-it-works         → HowItWorksPage
 *   /login                → LoginPage
 *   /signup               → SignupSelectionPage (role chooser)
 *   /signup/applicant     → Applicant signup (TODO page)
 *   /signup/employer      → Employer signup (TODO page)
 *   /signup/institution   → Institution signup (TODO page)
 *   *                     → Redirects to HomePage
 */
export default function App() {
  return (
    <PublicLayout>
      <Routes>
        {/* Homepage */}
        <Route path="/" element={<HomePage />} />

        {/* About page */}
        <Route path="/about" element={<AboutPage />} />

        {/* How it works page */}
        <Route path="/how-it-works" element={<HowItWorksPage />} />

        {/* Login page */}
        <Route path="/login" element={<LoginPage />} />

        {/* Signup flow */}
        <Route path="/signup" element={<SignupSelectionPage />} />
        <Route path="/signup/applicant" element={<SignupApplicant />} />
        <Route path="/signup/employer" element={<SignupEmployer />} />
        <Route path="/signup/institution" element={<SignupInstitution />} /> {/* Use your real component here */}
        <Route path="/signup/success/:role" element={<SuccessPending />} />
        {/* InstitutionRole*/}
        <Route path="/institution/upload" element={<UploadCertificate />} />

        {/* Fallback: redirect any unknown route to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </PublicLayout> 

  );
}
