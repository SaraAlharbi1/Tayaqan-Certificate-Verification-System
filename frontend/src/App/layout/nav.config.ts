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
    { to: "/applicant", label: "Home", end: true },
    { to: "/applicant/certificates", label: "My Certificates" },
    { to: "/applicant/requests", label: "Access Requests" },
  ],

  employer: [
    { to: "/employer", label: "Home", end: true },
    { to: "/employer/access", label: "Access Requests", end: true },
    { to: "/employer/access/new", label: "New Request", end: true },
  ],

  institution: [
    { to: "/institution", label: "Home", end: true },
    { to: "/institution/certificates", label: "Issued Certificates", end: true },
    { to: "/institution/upload", label: "Upload Certificate" },
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
