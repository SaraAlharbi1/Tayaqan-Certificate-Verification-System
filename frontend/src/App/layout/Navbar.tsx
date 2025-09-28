// src/components/Navbar.tsx
import { NavLink } from "react-router-dom";
import { useMemo } from "react";
import NavbarWave from "@/assets/navbar-wave.png";

type Role = "public" | "institution" | "employer" | "applicant";

type Props = {
  dense?: boolean;
  role?: Role | string;
};

export default function Navbar({ dense = false, role: roleProp }: Props) {
  const headerMargin = dense ? "mb-4 md:mb-6" : "mb-10 md:mb-14";
  const padTop = dense ? "pt-10 md:pt-14" : "pt-14 md:pt-20";
  const padBottom = dense ? "pb-16 md:pb-20" : "pb-28 md:pb-36";

  const normalize = (r?: string): Role => {
    const s = (r || "").toLowerCase();
    if (s.includes("institution")) return "institution";
    if (s.includes("employer") || s.includes("hr")) return "employer";
    if (s.includes("applicant") || s.includes("student")) return "applicant";
    return "public";
  };

  const role = useMemo<Role>(() => {
    if (roleProp) return normalize(String(roleProp));
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return normalize(u?.role);
    } catch {
      return "public";
    }
  }, [roleProp]);

  const LINKS: Record<Role, { to: string; label: string; end?: boolean }[]> = {
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
      { to: "/AccessRequests", label: "Home", end: true },
      { to: "/employer/access/new", label: "Request Access" },
    ],
    applicant: [
      { to: "/ApplicantPage", label: "Home", end: true },
      { to: "/applicant/certificates", label: "My Certificates" },
      { to: "/applicant/requests", label: "Access Requests" },
    ],
  };

  return (
    <header className={`relative text-white ${headerMargin}`}>
      <img
        src={NavbarWave}
        alt=""
        className="absolute inset-0 w-full h-auto pointer-events-none select-none"
      />
      <div className="relative z-10">
        <nav
          className={`mx-auto max-w-6xl px-6 ${padTop} ${padBottom} flex items-center justify-between gap-6`}
        >
          <div className="w-28" />
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
          <div className="w-28" />
        </nav>
      </div>
    </header>
  );
}
