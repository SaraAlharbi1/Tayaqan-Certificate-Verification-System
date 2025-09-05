// src/components/Navbar.tsx
import { NavLink } from "react-router-dom";
import NavbarWave from "@/assets/navbar-wave.png";

type Props = { dense?: boolean }; // optional flag to render a more compact navbar

/**
 * Navbar
 *
 * Displays the top navigation with a decorative wave background image.
 *
 * Props:
 * - dense (boolean): when true, navbar uses smaller paddings
 *   (used on auth pages like Login/Signup where we want less height).
 */
export default function Navbar({ dense = false }: Props) {
  // Adjust spacing dynamically based on `dense`
  const headerMargin = dense ? "mb-4 md:mb-6" : "mb-10 md:mb-14";
  const padTop = dense ? "pt-10 md:pt-14" : "pt-14 md:pt-20";
  const padBottom = dense ? "pb-16 md:pb-20" : "pb-28 md:pb-36";

  return (
    <header className={`relative text-white ${headerMargin}`}>
      {/* Background decorative curve (wave image) */}
      <img
        src={NavbarWave}
        alt=""
        className="absolute inset-0 w-full h-auto pointer-events-none select-none"
      />

      {/* Navigation links (centered) */}
      <div className="relative z-10">
        <nav
          className={`mx-auto max-w-6xl px-6 ${padTop} ${padBottom}
                      flex justify-center gap-16 text-lg md:text-xl font-semibold`}
        >
          <NavLink to="/" end className="text-white hover:opacity-90 transition-colors">
            Home
          </NavLink>
          <NavLink to="/about" className="text-white hover:opacity-90 transition-colors">
            About us
          </NavLink>
          <NavLink to="/how-it-works" className="text-white hover:opacity-90 transition-colors">
            How it works
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
