// src/pages/HomePage.tsx
import { Link } from "react-router-dom";
import HeroIllustration from "@/assets/hero-illustration.png";
import EducationalLogo from "@/assets/Educational-logo.png";
import EmployerLogo from "@/assets/Employer-logo.png";
import ApplicantLogo from "@/assets/Applicant-logo.png";

export default function HomePage() {
  const objectives = [
    {
      title: "Educational Institutions",
      description: "Automate the certificate verification process with blockchain security.",
      iconSrc: EducationalLogo,
      iconAlt: "Educational Institutions",
    },
    {
      title: "Employers",
      description: "Quick and reliable verification of applicant certificates on one platform.",
      iconSrc: EmployerLogo,
      iconAlt: "Employers",
    },
    {
      title: "Applicants",
      description: "Gather all certificates in one secure place to simplify applications.",
      iconSrc: ApplicantLogo,
      iconAlt: "Applicants",
    },
  ];

  return (
    <>
      {/* -------------------- HERO -------------------- */}
      <section className="bg-gradient-to-b from-white to-surface">
        <div className="mx-auto max-w-6xl px-6 pt-6 md:pt-8 pb-12 md:pb-16 grid md:grid-cols-2 gap-8 md:gap-10 items-start">
          <div className="flex flex-col justify-center">
            <h1 className="animate-fade-in-up text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Secure{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent animate-hero-shine">
                certificates
              </span>
              <br />
              <span className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
                Unified system
              </span>
            </h1>

            <p className="mt-3 text-muted max-w-xl animate-fade-in-up" style={{ animationDelay: "220ms" }}>
              A <span className="font-semibold text-brand-600">blockchain-powered</span> platform that
              ensures secure, transparent, and reliable certificate management.
            </p>

            <div className="mt-5 flex gap-3 animate-fade-in-up" style={{ animationDelay: "320ms" }}>
              <Link to="/signup" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-outline">Sign in</Link>
            </div>
          </div>

          {/* Right: illustration (keeps gentle float) */}
          <div className="relative flex justify-center md:justify-end translate-y-[-1rem] md:translate-y-[-1.5rem]">
            <img
              src={HeroIllustration}
              alt="Blockchain certificate illustration"
              className="w-auto max-h-[28rem] md:max-h-[36rem] select-none animate-float-medium will-change-transform"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* -------------------- OBJECTIVES -------------------- */}
      <section className="bg-white -mt-6 md:-mt-10">
        <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-10 pb-14 md:pb-16">
          <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-2">
            Our{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Objectives
            </span>
          </h2>
          <p className="text-center text-slate-600 mb-10"></p>

          <div className="grid gap-10 md:gap-12 md:grid-cols-3">
            {objectives.map((obj, i) => (
              // Make card focusable so keyboard users can trigger the same animation
              <div key={i} className="relative group" tabIndex={0}>
                <div className="pt-16 pb-8 px-6 bg-white rounded-2xl shadow-md border border-slate-200 group-hover:shadow-xl group-hover:border-indigo-300 transition-all duration-300 h-full flex flex-col animate-pop">
                  {/* Icon circle — NO default animation; only on hover/focus/click */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative">
                      <div
                        className="
                          h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600
                          flex items-center justify-center shadow-lg ring-4 ring-white
                          transition-transform duration-300
                          group-hover:scale-110 group-focus-visible:scale-110
                          group-hover:animate-float-medium group-focus-visible:animate-float-medium
                          active:scale-95
                        "
                      >
                        <img
                          src={obj.iconSrc}
                          alt={obj.iconAlt}
                          className="h-8 w-8 invert brightness-0 select-none"
                          draggable={false}
                        />
                      </div>
                      {/* Pulse glow only on hover/focus */}
                      <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-0 group-hover:opacity-20 group-focus-visible:opacity-20 group-hover:animate-ping" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 text-center mb-3 leading-tight">
                    {obj.title}
                  </h3>
                  <p className="text-sm text-slate-600 text-center leading-relaxed flex-grow">
                    {obj.description}
                  </p>
                  <div className="mt-6 mx-auto w-12 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inline animations */}
      <style>{`
@keyframes fade-in-up{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
@keyframes hero-shine{0%{background-position:0% 50%}100%{background-position:200% 50%}}
@keyframes float-medium{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes pop{0%{transform:scale(.96);opacity:0}100%{transform:scale(1);opacity:1}}

.animate-fade-in-up{animation:fade-in-up .7s ease-out both}
.animate-hero-shine{background-size:200% auto;animation:hero-shine 6s linear infinite}
.animate-float-medium{animation:float-medium 5s ease-in-out infinite}
.animate-pop{animation:pop .4s ease-out both}
      `}</style>
    </>
  );
}
