// src/pages/AboutUsPage.tsx
import { Link } from "react-router-dom";
import HeroIllustration from "@/assets/hero-illustration.png";
import EducationalLogo from "@/assets/Educational-logo.png";
import EmployerLogo from "@/assets/Employer-logo.png";
import ApplicantLogo from "@/assets/Applicant-logo.png";
import ObjectiveCard from "@/components/ObjectiveCard";

/**
 * AboutUsPage
 *
 * Public page describing Tayaqan: intro, mission & vision, and stakeholders.
 * Styled to match the HomePage and HowItWorksPage.
 */
export default function AboutUsPage() {
  return (
    <>
      {/* -------------------- HERO -------------------- */}
      <section className="bg-gradient-to-b from-white to-surface -mt-6 md:-mt-10">
        <div className="mx-auto max-w-6xl px-6 pt-6 md:pt-8 pb-12 md:pb-16 grid md:grid-cols-2 gap-8 md:gap-10 items-start">
          {/* Left: title + copy + CTA */}
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
              About{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Tayaqan
              </span>
              .
            </h1>

            <div className="mt-3 text-muted max-w-xl">
              <p>
                <span className="font-semibold text-brand-600">Tayaqan</span> is a secure platform for
                certificate issuance and verification, giving users control over their credentials,
                simplifying processes for all parties, and enabling trusted and transparent validation.
              </p>

              <div className="mt-5">
                <Link to="/signup" className="btn btn-primary">Get Started</Link>
              </div>
            </div>
          </div>

          {/* Right: illustration */}
          <div className="relative flex justify-center md:justify-end">
            <img
              src={HeroIllustration}
              alt="About Tayaqan illustration"
              className="w-auto max-h-[28rem] md:max-h-[36rem] -translate-y-4 md:-translate-y-6 select-none"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* -------------------- MISSION & VISION -------------------- */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-10">
            Our{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Mission
            </span>{" "}
            &{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Vision
            </span>
          </h2>

          <div className="grid gap-6 md:grid-cols-2 text-left">
            {/* Mission */}
            <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md">
              <div className="flex items-start gap-4 p-6 md:p-7">
                <div className="shrink-0 rounded-xl border border-black/5 bg-white p-2 shadow-sm">
                  <img src={EducationalLogo} alt="Mission icon" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Our Mission</h3>
                  <p className="text-muted">
                    Build trust in education and employment by providing a{" "}
                    <span className="font-semibold text-brand-600">transparent</span> and{" "}
                    <span className="font-semibold text-brand-600">secure</span> platform for managing,
                    issuing, and verifying academic and professional certificates.
                  </p>
                </div>
              </div>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2" />
            </div>

            {/* Vision */}
            <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-within:shadow-md">
              <div className="flex items-start gap-4 p-6 md:p-7">
                <div className="shrink-0 rounded-xl border border-black/5 bg-white p-2 shadow-sm">
                  <img src={EducationalLogo} alt="Vision icon" className="h-8 w-8 object-contain" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Our Vision</h3>
                  <p className="text-muted">
                    Become the{" "}
                    <span className="font-semibold text-brand-600">leading national</span> platform for
                    digital credential verification—aligned with Saudi Arabia’s Vision 2030 and the global
                    shift toward a knowledge economy.
                  </p>
                </div>
              </div>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2" />
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- STAKEHOLDERS -------------------- */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-10">
            Our{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Stakeholders
            </span>
          </h2>

        <div className="grid gap-6 md:grid-cols-3">
            <ObjectiveCard
              title="Educational Institutions"
              description="Issue tamper-proof digital certificates quickly and securely."
              iconSrc={EducationalLogo}
              iconAlt="Educational Institutions"
            />
            <ObjectiveCard
              title="HR Employers"
              description="Verify applicants’ qualifications instantly with full confidence."
              iconSrc={EmployerLogo}
              iconAlt="Employers"
            />
            <ObjectiveCard
              title="Applicants"
              description="Keep full control over which certificates you share and with whom."
              iconSrc={ApplicantLogo}
              iconAlt="Applicants"
            />
          </div>
        </div>
      </section>
    </>
  );
}
