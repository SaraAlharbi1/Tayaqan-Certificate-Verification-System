// src/App/layout/nav.config.ts
export type LinkItem = { to: string; label: string; end?: boolean };
export type Role = "public" | "applicant" | "employer" | "institution";

export const LINKS: Record<Role, LinkItem[]> = {
  public: [
    { to: "/", label: "Home", end: true },
    { to: "/about", label: "About us" },
    { to: "/how-it-works", label: "How it works" },
  ],
  applicant: [
    { to: "/ApplicantDashboard", label: "My Certificates", end: true }, // matches App.tsx
    { to: "/applicant/requests", label: "Access Requests" },
  ],
  employer: [
    { to: "/EmployerDashboard", label: "Dashboard", end: true },   // matches App.tsx
    { to: "/employer/access/new", label: "Create Access Request" },
  ],
  institution: [
    { to: "/institution/dashboard", label: "Dashboard", end: true },
    { to: "/institution/upload", label: "Upload Certificate" },
    // Add more when routes exist (e.g., /institution/students)
  ],
};

export const FORCE_PUBLIC_ON: string[] = [
  "/login",
  "/signup",
  "/signup/applicant",
  "/signup/employer",
  "/signup/institution",
  "/how-it-works",
  "/about",
  "/forgot-password",
  "/reset-password",
];
