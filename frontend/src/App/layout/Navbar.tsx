// src/App/layout/Navbar.tsx
import { NavLink, useLocation } from "react-router-dom";
import NavbarWave from "@/assets/navbar-wave.png";
import { LINKS, FORCE_PUBLIC_ON } from "./nav.config";

type Role = keyof typeof LINKS;

function detectRole(pathname: string): Role {
  const p = pathname.toLowerCase();
  if (FORCE_PUBLIC_ON.some((x) => p.startsWith(x))) return "public";
  if (p.startsWith("/institution")) return "institution";
  if (p.startsWith("/employer")) return "employer";
  if (p.startsWith("/applicant")) return "applicant";
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
      <img
        src={NavbarWave}
        alt=""
        className="absolute inset-0 w-full h-auto pointer-events-none select-none"
      />

      <div className="relative z-10">
        <nav
          className={`mx-auto max-w-6xl px-6 ${padTop} ${padBottom}
            flex justify-center gap-12 md:gap-16 text-lg md:text-xl font-semibold`}
        >
          {LINKS[role].map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end} // exact match; prevents /employer/access from matching /employer/access/new
              className={({ isActive }) =>
                `transition-all duration-200 relative ${
                  isActive
                    ? "text-white after:absolute after:bottom-[-4px] after:left-0 after:right-0 after:h-0.5 after:bg-white after:rounded-full"
                    : "text-white/90 hover:text-white"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
