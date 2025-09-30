// Navbar.tsx
import { NavLink, useLocation } from "react-router-dom";
import { useMemo } from "react";
import NavbarWave from "@/assets/navbar-wave.png";
import { LINKS, PUBLIC_PATHS, FORCE_PUBLIC_ON } from "./nav.config";

type Role = "public" | "institution" | "employer" | "applicant";
const normalizeRole = (r?: string): Role =>
  (r || "").toLowerCase().includes("institution") ? "institution" :
  (r || "").toLowerCase().match(/employer|hr/) ? "employer" :
  (r || "").toLowerCase().match(/applicant|student/) ? "applicant" : "public";

type Props = { dense?: boolean; role?: Role | string };

const size = {
  dense:  { header: "mb-4 md:mb-6", pad: "pt-10 md:pt-14 pb-16 md:pb-20" },
  normal: { header: "mb-10 md:mb-14", pad: "pt-14 md:pt-20 pb-28 md:pb-36" },
} as const;

export default function Navbar({ dense = false, role: roleProp }: Props) {
  const { pathname } = useLocation();

  // single, reusable helper
  const startsWithAny = (paths: string[]) =>
    paths.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p)));

  // decide menu: force public on auth pages; otherwise by role/localStorage
  const role = useMemo<Role>(() => {
    if (startsWithAny(FORCE_PUBLIC_ON) || startsWithAny(PUBLIC_PATHS)) return "public";
    if (roleProp) return normalizeRole(String(roleProp));
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return normalizeRole(u?.role);
    } catch {
      return "public";
    }
  }, [pathname, roleProp]);

  const variant = dense ? size.dense : size.normal;

  return (
    <header className={`relative text-white ${variant.header}`}>
      <img src={NavbarWave} alt="" className="absolute inset-0 w-full h-auto pointer-events-none select-none" />
      <div className="relative z-10">
        <nav className={`mx-auto max-w-6xl px-6 ${variant.pad} flex items-center justify-between gap-6`}>
          <div className="w-28" />
          <div className="flex-1 flex justify-center gap-8 md:gap-12 text-lg md:text-xl font-semibold">
            {LINKS[role].map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className="text-white/95 hover:text-white transition-colors">
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
