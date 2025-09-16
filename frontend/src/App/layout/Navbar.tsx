// src/components/Navbar.tsx
import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import NavbarWave from "@/assets/navbar-wave.png";
import Logo from "@/assets/logo.png";

type Role = "public" | "institution" | "employer" | "applicant";

type Props = {
  dense?: boolean;
  /** Optional: force a role from parent. If not provided, we read localStorage.user.role */
  role?: Role | string;
};

export default function Navbar({ dense = false, role: roleProp }: Props) {
  // spacing
  const headerMargin = dense ? "mb-4 md:mb-6" : "mb-10 md:mb-14";
  const padTop = dense ? "pt-10 md:pt-14" : "pt-14 md:pt-20";
  const padBottom = dense ? "pb-16 md:pb-20" : "pb-28 md:pb-36";

  // normalize any string to one of our roles (default = public)
  const normalize = (r?: string): Role => {
    const s = (r || "").toLowerCase();
    if (s.includes("institution")) return "institution";
    if (s.includes("employer") || s.includes("hr")) return "employer";
    if (s.includes("applicant") || s.includes("student")) return "applicant";
    return "public";
  };

  // source of truth: prop → localStorage.user.role → "public"
  const role = useMemo<Role>(() => {
    if (roleProp) return normalize(String(roleProp));
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return normalize(u?.role);
    } catch {
      return "public";
    }
  }, [roleProp]);

  // role → links (NO admin; public is the default)
const LINKS: Record<Role, { to: string; label: string; end?: boolean }[]> = {
  public: [
    { to: "/", label: "Home", end: true },
    { to: "/about", label: "About us" },
    { to: "/how-it-works", label: "How it works" },
  ],

  // ⬇⬇ matches App.tsx
  institution: [
    { to: "/institution/dashboard", label: "Home", end: true },   // was /institution
    { to: "/institution/upload", label: "Upload Certificates" },
  ],

  // ⬇⬇ matches App.tsx (note: you don't have /employer/access-requests route)
  employer: [
    { to: "/AccessRequests", label: "Access Requests", end: true }, // route in App.tsx is PascalCase
    { to: "/employer/access/new", label: "Request Access" },
    // For "shared certificates" you only have a route with an :applicantId param:
    // { to: "/employer/applicants/:applicantId/shared", label: "Shared Certificates" }
    // You can't link to that directly without an id, so omit it from the navbar for now.
  ],

  // ⬇⬇ matches App.tsx
  applicant: [
    { to: "/ApplicantPage", label: "Home", end: true },            // route is PascalCase
    { to: "/applicant/certificates", label: "My Certificates" },
    { to: "/applicant/requests", label: "Requests" },
  ],
};

  return (
    <header className={`relative text-white ${headerMargin}`}>
      {/* Background decorative curve (wave image) */}
      <img
        src={NavbarWave}
        alt=""
        className="absolute inset-0 w-full h-auto pointer-events-none select-none"
      />

      <div className="relative z-10">
        <nav
          className={`mx-auto max-w-6xl px-6 ${padTop} ${padBottom}
                      flex items-center justify-between gap-6`}
        >
          {/* Left: Logo */}
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <img src={Logo} alt="Tayaqan" className="h-9 w-auto" />
            <span className="sr-only">Tayaqan</span>
          </NavLink>

          {/* Center: role-based links */}
          <div className="flex-1 flex justify-center gap-8 md:gap-12 text-lg md:text-xl font-semibold">
            {LINKS[role].map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="text-white/95 hover:text-white transition-colors"
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right: spacer to keep center content perfectly centered */}
          <div className="w-28" />
        </nav>
      </div>
    </header>
  );
}
