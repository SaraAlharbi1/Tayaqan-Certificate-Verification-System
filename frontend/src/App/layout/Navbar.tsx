// src/components/Navbar.tsx
import { NavLink, useLocation, useMatch } from "react-router-dom";
import NavbarWave from "@/assets/navbar-wave.png";

type Props = { dense?: boolean };

export default function Navbar({ dense = false }: Props) {
  const { pathname } = useLocation();

  // matches دقيقة لمسارات المتقدّم (Applicant)
  const mAppCerts = useMatch({ path: "/applicant/certificates", end: true });
  const mAppReqs  = useMatch({ path: "/applicant/requests", end: true });
  const mAppReqId = useMatch({ path: "/applicant/requests/:id", end: true });

  // matches للأدوار الأخرى (لو احتجتيها لاحقًا)
  const isApplicant   = pathname.startsWith("/applicant");
  const isEmployer    = pathname.startsWith("/employer");
  const isInstitution = pathname.startsWith("/institution");

  const headerMargin = dense ? "mb-4 md:mb-6" : "mb-10 md:mb-14";
  const padTop       = dense ? "pt-10 md:pt-14" : "pt-14 md:pt-20";
  const padBottom    = dense ? "pb-16 md:pb-20" : "pb-28 md:pb-36";

  // دالة صغيرة: لو الرابط مفعل، نعرض "Home" ونوجهه لصفحة الهوم الخاصة بالدور
  const LinkAsHome = ({
    isActive,
    to,
    label,
    homeTo,
  }: {
    isActive: boolean;
    to: string;
    label: string;
    homeTo: string;
  }) => (
    <NavLink to={isActive ? homeTo : to} className="text-white hover:opacity-90 transition-colors">
      {isActive ? "Home" : label}
    </NavLink>
  );

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
                      flex justify-center gap-16 text-lg md:text-xl font-semibold`}
        >
          {/* Applicant navbar - ترتيب ثابت، وأقرب match فقط يتحول Home */}
          {isApplicant && (
            <>
              <LinkAsHome
                isActive={!!mAppCerts}
                to="/applicant/certificates"
                label="My Certificates"
                homeTo="/applicant"
              />
              <LinkAsHome
                isActive={!!mAppReqs}
                to="/applicant/requests"
                label="Access Requests"
                homeTo="/applicant"
              />
              <LinkAsHome
                isActive={!!mAppReqId}
                to="/applicant/requests/1"
                label="Access Certificates"
                homeTo="/applicant"
              />
            </>
          )}

          {/* Employer navbar (إن احتجتيه لاحقًا) */}
          {isEmployer && (
            <>
              <NavLink to="/employer" className="text-white hover:opacity-90 transition-colors">
                Dashboard
              </NavLink>
              <NavLink to="/employer/verify" className="text-white hover:opacity-90 transition-colors">
                Verify Certificates
              </NavLink>
              <NavLink to="/employer/requests" className="text-white hover:opacity-90 transition-colors">
                Requests
              </NavLink>
            </>
          )}

          {/* Institution navbar (إن احتجتيه لاحقًا) */}
          {isInstitution && (
            <>
              <NavLink to="/institution" className="text-white hover:opacity-90 transition-colors">
                Dashboard
              </NavLink>
              <NavLink to="/institution/issue" className="text-white hover:opacity-90 transition-colors">
                Issue Certificates
              </NavLink>
              <NavLink to="/institution/students" className="text-white hover:opacity-90 transition-colors">
                Manage Students
              </NavLink>
            </>
          )}

          {/* Public navbar */}
          {!isApplicant && !isEmployer && !isInstitution && (
            <>
              <NavLink to="/" end className="text-white hover:opacity-90 transition-colors">
                Home
              </NavLink>
              <NavLink to="/about" className="text-white hover:opacity-90 transition-colors">
                About us
              </NavLink>
              <NavLink to="/how-it-works" className="text-white hover:opacity-90 transition-colors">
                How it works
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

