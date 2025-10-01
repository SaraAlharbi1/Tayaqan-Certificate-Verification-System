// src/App/layout/Navbar.tsx
import { NavLink, useLocation } from "react-router-dom";
import NavbarWave from "@/assets/navbar-wave.png";
import { LINKS, FORCE_PUBLIC_ON } from "./nav.config";

type Role = keyof typeof LINKS;

function detectRole(pathname: string): Role {
  const p = pathname.toLowerCase();

  if (FORCE_PUBLIC_ON.some(x => p.startsWith(x))) return "public";
  if (p.startsWith("/institution") || p === "/institutiondashboard") return "institution";
  if (p.startsWith("/employer") || p === "/employerdashboard") return "employer";
  if (p.startsWith("/applicant") || p === "/applicantdashboard") return "applicant";
  return "public";
}

export default function Navbar({ dense = false }: { dense?: boolean }) {
  const { pathname } = useLocation();
  const role: Role = detectRole(pathname);

  const headerMargin = dense ? "mb-4 md:mb-6" : "mb-10 md:mb-14";
  const padTop = dense ? "pt-10 md:pt-14" : "pt-14 md:pt-20";
  const padBottom = dense ? "pb-16 md:pb-20" : "pb-28 md:pb-36";

  return (
    <header className={`relative text-white ${headerMargin}`}>
      {/* Decorative curve */}
      <img
        src={NavbarWave}
        alt=""
        className="absolute inset-0 w-full h-auto pointer-events-none select-none"
      />

      {/* Navbar links */}
      <div className="relative z-10">
        <nav
          className={`mx-auto max-w-6xl px-6 ${padTop} ${padBottom}
            flex justify-center gap-16 text-lg md:text-xl font-semibold`}
        >
          {LINKS[role].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="text-white hover:opacity-90 transition-colors"
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
