// src/pages/auth/SignupSelectionPage.tsx
import { Link } from "react-router-dom";
import EducationalLogo from "@/assets/Educational-logo.png";
import EmployerLogo from "@/assets/Employer-logo.png";
import ApplicantLogo from "@/assets/Applicant-logo.png";

export default function SignupSelectionPage() {
  const roles = [
    {
      key: "institution",
      title: "Educational Institutions",
      desc: "Automate the certificate verification process with blockchain security.",
      href: "/signup/institution",
      icon: EducationalLogo,
      alt: "Educational Institutions",
      cta: "Continue as Institution",
    },
    {
      key: "employer",
      title: "Employers",
      desc: "Quick and reliable verification of applicant certificates on one platform.",
      href: "/signup/employer",
      icon: EmployerLogo,
      alt: "Employers",
      cta: "Continue as Employer (HR)",
    },
    {
      key: "applicant",
      title: "Applicants",
      desc: "Gather all certificates in one secure place to simplify applications.",
      href: "/signup/applicant",
      icon: ApplicantLogo,
      alt: "Applicants",
      cta: "Continue as Applicant",
    },
  ];

  return (
    <section className="bg-white -mt-6 md:-mt-10">
      <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-10 pb-14 md:pb-16">
        {/* Heading */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            Choose Your{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Role
            </span>
          </h1>
          <p className="mt-1 text-slate-600">Select your account type to get started</p>
        </div>

        {/* Cards with the same hover as HomePage “Objectives” */}
        <div className="grid gap-10 md:gap-12 md:grid-cols-3">
          {roles.map((r, i) => (
            <div key={r.key} className="relative group" tabIndex={0} style={{ animationDelay: `${i * 80}ms` }}>
              <div className="pt-16 pb-8 px-6 bg-white rounded-2xl shadow-md border border-slate-200
                              group-hover:shadow-xl group-hover:border-indigo-300 transition-all duration-300
                              h-full flex flex-col animate-pop relative overflow-visible">
                {/* Floating icon (same behavior) */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="relative">
                    <div
                      className="
                        h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600
                        grid place-items-center shadow-lg ring-4 ring-white
                        transition-transform duration-300
                        group-hover:scale-110 group-focus-visible:scale-110
                        group-hover:animate-float-medium group-focus-visible:animate-float-medium
                        active:scale-95
                      "
                    >
                      <img
                        src={r.icon}
                        alt={r.alt}
                        className="h-8 w-8 invert brightness-0 select-none"
                        draggable={false}
                      />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-0
                                    group-hover:opacity-20 group-focus-visible:opacity-20 group-hover:animate-ping" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 text-center mb-3 leading-tight">
                  {r.title}
                </h3>
                <p className="text-sm text-slate-600 text-center leading-relaxed flex-grow">
                  {r.desc}
                </p>

                <div className="mt-6">
                  <Link
                    to={r.href}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold
                               text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                    aria-label={`Continue as ${r.title}`}
                  >
                    {r.cta}
                  </Link>
                </div>

                <div className="mt-6 mx-auto w-12 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full
                                opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </div>
      </div>

      {/* Inline animations to match HomePage */}
      <style>{`
@keyframes float-medium{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes pop{0%{transform:scale(.96);opacity:0}100%{transform:scale(1);opacity:1}}
.animate-pop{animation:pop .4s ease-out both}
.animate-float-medium{animation:float-medium 5s ease-in-out infinite}
      `}</style>
    </section>
  );
}
