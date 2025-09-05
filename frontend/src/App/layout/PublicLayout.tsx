import { PropsWithChildren } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { useLocation } from "react-router-dom";

/**
 * PublicLayout
 *
 * - Wraps all public-facing pages with Navbar + Footer
 * - Detects current path using `useLocation`
 * - If route is `/login` or `/signup`, uses `dense` Navbar for less vertical space
 */
export default function PublicLayout({ children }: PropsWithChildren) {
  const { pathname } = useLocation();

  // Mark auth routes (login, signup) as dense
  const isAuth = pathname.startsWith("/login") || pathname.startsWith("/signup");

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <Navbar dense={isAuth} />
      <main id="content" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
