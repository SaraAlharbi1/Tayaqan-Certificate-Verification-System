import { Link } from "react-router-dom";
import HeroIllustration from "@/assets/hero-illustration.png";
import EducationalLogo from "@/assets/Educational-logo.png";
import EmployerLogo from "@/assets/Employer-logo.png";
import ApplicantLogo from "@/assets/Applicant-logo.png";
import ObjectiveCard from "@/components/ObjectiveCard";

/**
 * Public landing page
 * - Hero with gradient-accented keywords + primary CTAs
 * - Objectives grid using the shared ObjectiveCard
 */
export default function HomePage() {
  return (
    <>
      {/* -------------------- HERO -------------------- */}
      <section className="bg-gradient-to-b from-white to-surface">
        <div className="mx-auto max-w-6xl px-6 pt-6 md:pt-8 pb-12 md:pb-16 grid md:grid-cols-2 gap-8 md:gap-10 items-start">
          {/* Left: headline + copy + CTAs */}
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Secure{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                certificates
              </span>
              .
              <br />
              Unified system
            </h1>

            <p className="mt-3 text-muted max-w-xl">
              A <span className="font-semibold text-brand-600">blockchain-powered</span> platform that
              ensures secure, transparent, and reliable credential management.
            </p>

            <div className="mt-5 flex gap-3">
              <Link to="/signup" className="btn btn-primary">
                Get Started
              </Link>
              <Link to="/login" className="btn btn-outline">
                Sign in
              </Link>
            </div>
          </div>

          {/* Right: illustration */}
          <div className="relative flex justify-center md:justify-end">
            <img
              src={HeroIllustration}
              alt="Blockchain credential illustration"
              className="w-auto max-h-[28rem] md:max-h-[36rem] -translate-y-4 md:-translate-y-6 select-none"
              draggable={false}
            />
          </div>
        </div>
      </section>

      {/* -------------------- OBJECTIVES -------------------- */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight mb-10">
            Our{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Objectives
            </span>
          </h2>

          <div className="grid gap-6 md:grid-cols-3">
            <ObjectiveCard
              title="Educational Institutions"
              description="Automate the credential verification process."
              iconSrc={EducationalLogo}
              iconAlt="Educational Institutions"
            />
            <ObjectiveCard
              title="Employers"
              description="A unified platform for quick and reliable verification of applicant credentials."
              iconSrc={EmployerLogo}
              iconAlt="Employers"
            />
            <ObjectiveCard
              title="Applicants"
              description="Gather all credentials in one secure place to simplify job applications."
              iconSrc={ApplicantLogo}
              iconAlt="Applicants"
            />
          </div>
        </div>
      </section>
    </>
  );
}
