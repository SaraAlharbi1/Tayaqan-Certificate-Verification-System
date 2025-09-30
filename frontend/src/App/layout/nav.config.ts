// nav.config.ts
export const FORCE_PUBLIC_ON = ["/login", "/signup", "/forgot-password", "/reset-password"];
export const PUBLIC_TOP = ["/", "/about", "/how-it-works"];
export const PUBLIC_PATHS = [...PUBLIC_TOP, ...FORCE_PUBLIC_ON];

export const LINKS = {
  public: [
    { to: "/", label: "Home", end: true },
    { to: "/about", label: "About us" },
    { to: "/how-it-works", label: "How it works" },
  ],
  institution: [
    { to: "/institution/dashboard", label: "Home", end: true },
    { to: "/institution/upload", label: "Upload Certificates" },
  ],
  employer: [
    { to: "/employer/access-requests", label: "Home", end: true },
    { to: "/employer/access/new", label: "Request Access" },
  ],
  applicant: [
    { to: "/applicant", label: "Home", end: true },
    { to: "/applicant/certificates", label: "My Certificates" },
    { to: "/applicant/requests", label: "Access Requests" },
  ],
} as const;
