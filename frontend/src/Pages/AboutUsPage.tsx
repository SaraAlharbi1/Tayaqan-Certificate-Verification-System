// src/pages/AboutUsPage.tsx
import { Link } from "react-router-dom";
import HeroIllustration from "@/assets/hero-illustration.png";
import EducationalLogo from "@/assets/Educational-logo.png";
import EmployerLogo from "@/assets/Employer-logo.png";
import ApplicantLogo from "@/assets/Applicant-logo.png";

/**
 * AboutUsPage
 * Public page describing Tayaqan: intro, mission & vision, and stakeholders.
 * Logos animate only on hover/focus (not by default).
 */
export default function AboutUsPage() {
  const stakeholders = [
    {
      title: "Educational Institutions",
      description: "Issue tamper proof digital certificates quickly and securely.",
      iconSrc: EducationalLogo,
      iconAlt: "Educational Institutions",
    },
    {
      title: "HR Employers",
      description: "Verify applicants' qualifications instantly with full confidence.",
      iconSrc: EmployerLogo,
      iconAlt: "Employers",
    },
    {
      title: "Applicants",
      description: "Keep full control over which certificates you share and with whom.",
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
              About{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent animate-hero-shine">
                Tayaqan
              </span>
            </h1>

            <p className="mt-3 text-muted max-w-xl animate-fade-in-up" style={{ animationDelay: "140ms" }}>
              <span className="font-semibold text-brand-600">Tayaqan</span> is a secure platform for
              certificate issuance and verification, giving users control over their certificates,
              simplifying processes for all parties, and enabling trusted and transparent validation.
            </p>

            <div className="mt-5 flex gap-3 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
              <Link to="/signup" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-outline">Sign in</Link>
            </div>
          </div>

          {/* Right: illustration (gentle float) */}
          <div className="relative flex justify-center md:justify-end translate-y-[-1rem] md:translate-y-[-1.5rem]">
            <img
              src={HeroIllustration}
              alt="About Tayaqan illustration"
              className="w-auto max-h-[28rem] md:max-h-[36rem] select-none animate-float-medium will-change-transform"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* -------------------- MISSION & VISION -------------------- */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 pt-12 md:pt-16 pb-16 md:pb-20">
          <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-2 animate-fade-in-up">
            Our{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Mission
            </span>{" "}
            &{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Vision
            </span>
          </h2>
          <p className="text-center text-slate-600 mb-10"></p>

          <div className="grid gap-12 md:grid-cols-2">
            {/* Mission */}
            <div className="relative group animate-pop" tabIndex={0}>
              <div className="pt-16 pb-8 px-6 bg-white rounded-2xl shadow-md border border-slate-200 group-hover:shadow-xl group-hover:border-indigo-300 transition-all duration-300 h-full flex flex-col">
                {/* Icon circle (hover/focus anim only) */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <div className="relative">
                    <div
                      className="
                        h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600
                        flex items-center justify-center shadow-lg
                        transition-transform duration-300
                        group-hover:scale-110 group-focus-visible:scale-110
                        group-hover:animate-float-medium group-focus-visible:animate-float-medium
                        active:scale-95
                      "
                    >
                      <img
                        src={EducationalLogo}
                        alt="Mission icon"
                        className="h-8 w-8 invert brightness-0 select-none"
                        draggable={false}
                      />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-0 group-hover:opacity-20 group-focus-visible:opacity-20 group-hover:animate-ping" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 text-center mb-3 leading-tight">
                  Our Mission
                </h3>
                <p className="text-sm text-slate-600 text-center leading-relaxed flex-grow">
                  Build trust in education and employment by providing a{" "}
                  <span className="font-semibold text-brand-600">transparent</span> and{" "}
                  <span className="font-semibold text-brand-600">secure</span> platform for managing,
                  issuing, and verifying academic and professional certificates.
                </p>
                <div className="mt-6 mx-auto w-12 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>

            {/* Vision */}
            <div className="relative group animate-pop" style={{ animationDelay: "100ms" }} tabIndex={0}>
              <div className="pt-16 pb-8 px-6 bg-white rounded-2xl shadow-md border border-slate-200 group-hover:shadow-xl group-hover:border-indigo-300 transition-all duration-300 h-full flex flex-col">
                {/* Icon circle (hover/focus anim only) */}
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                  <div className="relative">
                    <div
                      className="
                        h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600
                        flex items-center justify-center shadow-lg
                        transition-transform duration-300
                        group-hover:scale-110 group-focus-visible:scale-110
                        group-hover:animate-float-medium group-focus-visible:animate-float-medium
                        active:scale-95
                      "
                    >
                      <img
                        src={EducationalLogo}
                        alt="Vision icon"
                        className="h-8 w-8 invert brightness-0 select-none"
                        draggable={false}
                      />
                    </div>
                    <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-0 group-hover:opacity-20 group-focus-visible:opacity-20 group-hover:animate-ping" />
                  </div>
                </div>

                <h3 className="text-xl font-bold text-slate-900 text-center mb-3 leading-tight">
                  Our Vision
                </h3>
                <p className="text-sm text-slate-600 text-center leading-relaxed flex-grow">
                  Become the{" "}
                  <span className="font-semibold text-brand-600">leading national</span> platform for
                  digital certificate verification, aligned with Saudi Arabia's Vision 2030 and the global
                  shift toward a knowledge economy.
                </p>
                <div className="mt-6 mx-auto w-12 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- STAKEHOLDERS -------------------- */}
      <section className="bg-white mt-12 md:mt-16">
        <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-12 pb-14 md:pb-20">
          <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 mb-2 animate-fade-in-up">
            Our{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Stakeholders
            </span>
          </h2>
          <p className="text-center text-slate-600 mb-10"></p>

          <div className="grid gap-10 md:gap-12 md:grid-cols-3">
            {stakeholders.map((s, i) => (
              <div key={i} className="relative group animate-pop" style={{ animationDelay: `${i * 80}ms` }} tabIndex={0}>
                <div className="pt-16 pb-8 px-6 bg-white rounded-2xl shadow-md border border-slate-200 group-hover:shadow-xl group-hover:border-indigo-300 transition-all duration-300 h-full flex flex-col">
                  {/* Icon circle (hover/focus anim only) */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <div className="relative">
                      <div
                        className="
                          h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600
                          flex items-center justify-center shadow-lg
                          transition-transform duration-300
                          group-hover:scale-110 group-focus-visible:scale-110
                          group-hover:animate-float-medium group-focus-visible:animate-float-medium
                          active:scale-95
                        "
                      >
                        <img
                          src={s.iconSrc}
                          alt={s.iconAlt}
                          className="h-8 w-8 invert brightness-0 select-none"
                          draggable={false}
                        />
                      </div>
                      <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-0 group-hover:opacity-20 group-focus-visible:opacity-20 group-hover:animate-ping" />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 text-center mb-3 leading-tight">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-600 text-center leading-relaxed flex-grow">
                    {s.description}
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
