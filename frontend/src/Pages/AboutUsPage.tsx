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
          <div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              About <span className="text-brand-600">Tayaqan.</span>
            </h1>
            <p className="mt-2 md:mt-3 text-muted max-w-xl">
              <span className="text-brand-600 font-bold">Tayaqan</span> is a secure platform for certificate issuance and
              verification, empowering students, simplifying processes for
              institutions, and enabling trusted hiring for employers.
            </p>
            <div className="mt-4 md:mt-5">
              <Link to="/signup" className="btn btn-primary">Get Started</Link>
            </div>
          </div>

          {/* Right: illustration */}
          <div className="relative flex justify-center md:justify-end">
            <img
              src={HeroIllustration}
              alt="About Tayaqan Illustration"
              className="w-auto max-h-[28rem] md:max-h-[36rem] -translate-y-4 md:-translate-y-6"
            />
          </div>
        </div>
      </section>

      {/* -------------------- MISSION & VISION -------------------- */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-10">
            Our <span className="text-brand-600">Mission</span>{" "}
           <span className="text-black">&</span>{" "}
           <span className="text-brand-600">Vision</span>
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
                    To build trust in education and employment by providing a{" "}
                    <span className="font-semibold text-brand-600">transparent</span> and{" "}
                    <span className="font-semibold text-brand-600">secure</span> platform for
                    managing, issuing, and verifying academic and professional certificates.
                  </p>
                </div>
              </div>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2"></span>
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
                    To become the <span className="font-semibold text-brand-600">leading national</span>{" "}
                    platform for digital credential verification, aligned with Saudi Arabia’s Vision 2030
                    and global transformation toward a knowledge economy.
                  </p>
                </div>
              </div>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2"></span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------- STAKEHOLDERS -------------------- */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-10">
            Our <span className="text-brand-600">Stakeholders</span>
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
              description="Decide which certificates to share, giving you complete control over your credentials."
              iconSrc={ApplicantLogo}
              iconAlt="Applicants"
            />
          </div>
        </div>
      </section>
    </>
  );
}
