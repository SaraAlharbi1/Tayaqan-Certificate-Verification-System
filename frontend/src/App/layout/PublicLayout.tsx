// src/App/layout/PublicLayout.tsx
import { PropsWithChildren } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useLocation } from "react-router-dom";

// Pages that need extra lift to reduce top spacing
const EXTRA_LIFT_PATHS: string[] = [
  "/login",
  "/signup/applicant",
  "/signup/employer",
  "/signup/institution",
  "/forgot-password",
  "/reset-password",
  "/institution",
  "/institution/upload",
  "/applicant/certificates",
  "/applicant/requests",
  "/employer/access",
  "/employer/access/new",
  "/applicant",
  "/employer",
  "/employer/certificates/:certificateId",
  "/institution/success",
];

export default function PublicLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const needsExtraLift = EXTRA_LIFT_PATHS.some((p) => pathname.startsWith(p));

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar dense={false} />
      {/* Apply consistent spacing - always lift content up to match navbar */}
      <main
        id="content"
        className={[
          "flex-1",
          "py-8",
          // Apply extra lift only for signup pages to reduce top spacing
          needsExtraLift ? "-mt-20 md:-mt-28" : "-mt-8 md:-mt-12",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-6xl px-4">{children}</div>
      </main>
      <Footer compact={false} />
    </div>
  );
}