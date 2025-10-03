// src/pages/auth/SignupSelectionPage.tsx
import { Link } from "react-router-dom";
import EducationalLogo from "@/assets/Educational-logo.png";
import EmployerLogo from "@/assets/Employer-logo.png";
import ApplicantLogo from "@/assets/Applicant-logo.png";

/**
 * SignupSelectionPage
 * Role chooser → routes to:
 * - /signup/applicant
 * - /signup/employer
 * - /signup/institution
 */
export default function SignupSelectionPage() {
  return (
    <section className="bg-gradient-to-b from-white to-surface -mt-6 md:-mt-10">
      <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-10 pb-14 md:pb-16">
        {/* Heading (brand gradient like other pages) */}
        <h1 className="text-center text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
          Choose your{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            role
          </span>{" "}
          to get started
        </h1>
        <div className="flex justify-center mt-4 mb-10">
          <span className="block h-1 w-16 bg-brand-600 rounded-full" />
        </div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Applicant */}
          <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start gap-4 p-6 md:p-7">
              <div className="shrink-0 rounded-xl border border-black/5 bg-white p-2 shadow-sm">
                <img src={ApplicantLogo} alt="Applicant" className="h-10 w-10 object-contain" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Applicant</h3>
                <p className="text-muted mt-1">
                  Create your account, store certificates, and share them securely.
                </p>
              </div>
            </div>
            <div className="px-6 md:px-7 pb-6">
              <Link
                to="/signup/applicant"
                className="btn btn-primary w-full"
                aria-label="Continue as Applicant"
              >
                Continue as Applicant
              </Link>
            </div>
            <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2" />
          </div>

          {/* Employer */}
          <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start gap-4 p-6 md:p-7">
              <div className="shrink-0 rounded-xl border border-black/5 bg-white p-2 shadow-sm">
                <img src={EmployerLogo} alt="Employer (HR)" className="h-10 w-10 object-contain" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Employer (HR)</h3>
                <p className="text-muted mt-1">
                  Request access and verify candidates’ credentials instantly.
                </p>
              </div>
            </div>
            <div className="px-6 md:px-7 pb-6">
              <Link
                to="/signup/employer"
                className="btn btn-primary w-full"
                aria-label="Continue as Employer"
              >
                Continue as Employer
              </Link>
            </div>
            <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2" />
          </div>

          {/* Institution */}
          <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start gap-4 p-6 md:p-7">
              <div className="shrink-0 rounded-xl border border-black/5 bg-white p-2 shadow-sm">
                <img src={EducationalLogo} alt="Institution" className="h-10 w-10 object-contain" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Institution</h3>
                <p className="text-muted mt-1">
                  Issue tamper-proof certificates and streamline verification.
                </p>
              </div>
            </div>
            <div className="px-6 md:px-7 pb-6">
              <Link
                to="/signup/institution"
                className="btn btn-primary w-full"
                aria-label="Continue as Institution"
              >
                Continue as Institution
              </Link>
            </div>
            <span className="pointer-events-none absolute inset-0 rounded-2xl ring-0 ring-brand-600/10 transition group-hover:ring-2 group-focus-within:ring-2" />
          </div>
        </div>
      </div>
    </section>
  );
}
