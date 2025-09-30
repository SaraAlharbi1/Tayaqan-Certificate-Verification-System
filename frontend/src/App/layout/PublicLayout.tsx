// src/App/layout/PublicLayout.tsx
import { PropsWithChildren } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useLocation } from "react-router-dom";

// Add any page that should use the shorter header (e.g., AccessRequests)
const COMPACT_PATHS = [
  "/login",
  "/signup/applicant",
  "/forgot-password",
  "/reset-password",
  "/AccessRequests",
  "/ApplicantPage",
  "/applicant/certificates",
  "/applicant/requests",
  "/employer/access/new",
  "/institution/dashboard",
  "/institution/upload",
 
];

export default function PublicLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const isCompact = COMPACT_PATHS.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar dense={isCompact} />
      <main id="content" className={isCompact ? "flex-1 py-8" : "flex-1 py-12"}>
        <div className="mx-auto w-full max-w-6xl px-4">{children}</div>
      </main>
      <Footer compact={isCompact} />
    </div>
  );
}
