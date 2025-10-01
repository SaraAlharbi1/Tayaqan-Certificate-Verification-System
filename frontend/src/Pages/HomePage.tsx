import { Link } from "react-router-dom";
import HeroIllustration from "@/assets/hero-illustration.png";
import EducationalLogo from "@/assets/Educational-logo.png";
import EmployerLogo from "@/assets/Employer-logo.png";
import ApplicantLogo from "@/assets/Applicant-logo.png";
import ObjectiveCard from "@/components/ObjectiveCard";

/**
 * HomePage component
 *
 * This page serves as the public landing page of the system.
 * It contains:
 *   1. Hero Section – introduction (headline + description) and call-to-action buttons
 *   2. Objectives Section – highlights for institutions, employers, and applicants
 */
export default function HomePage() {
  return (
    <>
      {/* -------------------- HERO SECTION -------------------- */}
      <section className="bg-gradient-to-b from-white to-surface ">
        <div className="mx-auto max-w-6xl px-6 pt-6 md:pt-8 pb-12 md:pb-16 grid md:grid-cols-2 gap-8 md:gap-10 items-start">
          
          {/* LEFT SIDE: Main heading, description, and CTAs */}
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Secure <span className="text-brand-600">certificates.</span>
              <br /> Unified system
            </h1>
            {/* Paragraph pulled closer to heading */}
            <p className="mt-2 md:mt-3 text-muted max-w-xl">
              A <span className="font-semibold text-brand-600">blockchain-powered</span> system that
              ensures secure, transparent, and reliable credential management.
            </p>
            {/* Call-to-action buttons */}
            <div className="mt-4 md:mt-5 flex gap-3">
              <Link to="/signup" className="btn btn-primary">Get Started</Link>
              <Link to="/login" className="btn btn-outline">Sign in</Link>
            </div>
          </div>

          {/* RIGHT SIDE: Hero illustration (bigger + slightly lifted) */}
          <div className="relative flex justify-center md:justify-end">
            <img
              src={HeroIllustration}
              alt="Blockchain Illustration"
              className="w-auto max-h-[28rem] md:max-h-[36rem] -translate-y-4 md:-translate-y-6"
            />
          </div>
        </div>
      </section>

      {/* -------------------- OBJECTIVES SECTION -------------------- */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-6xl px-6">
          {/* Section heading */}
          <h2 className="text-center text-3xl md:text-4xl font-bold mb-10">
            Our Objectives
          </h2>

          {/* Objective cards (reusable component) */}
          <div className="grid gap-6 md:grid-cols-3">
            <ObjectiveCard
              title="Educational Institutions"
              description="Automate the credential verification process."
              iconSrc={EducationalLogo}
              iconAlt="Educational Institutions"
            />
            <ObjectiveCard
              title="Employers"
              description="Provide a unified platform that enables quick and reliable verification of applicant credentials."
              iconSrc={EmployerLogo}
              iconAlt="Employers"
            />
            <ObjectiveCard
              title="Applicants"
              description="Gather all credentials into one accessible and secure system, simplifying job applications."
              iconSrc={ApplicantLogo}
              iconAlt="Applicants"
            />
          </div>
        </div>
      </section>
    </>
  );
}
