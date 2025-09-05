// src/pages/HowItWorksPage.tsx
import DownloadIcon from "@/assets/Download-icon.png";
import SendIcon from "@/assets/Send-icon.png";
import CheckIcon from "@/assets/Check-icon.png";
import UserIcon from "@/assets/User-icon.png";

/**
 * HowItWorksPage component
 *
 * This page explains the 4-step workflow of the Tayaqan system.
 * It contains:
 *   1. Section heading – styled with brand underline + subtitle
 *   2. Step Cards – four sequential steps:
 *        - Institutions Issue Certificates
 *        - Employers Request Access
 *        - Applicants Approve Request
 *        - Employers Verify Instantly
 *   
 */
export default function HowItWorksPage() {
  return (
    <section className="bg-white -mt-6 md:-mt-10">
      <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-10 pb-14 md:pb-16">
        {/* Heading + subtitle */}
        <h2 className="text-center text-3xl md:text-4xl font-bold mb-3 relative inline-block w-full">
          How it <span className="text-brand-600">works</span>
        </h2>
        <div className="flex justify-center mb-10">
          <span className="block h-1 w-16 bg-brand-600 rounded-full" />
        </div>
        {/* Steps */}
        <div className="grid gap-8 md:grid-cols-4">
          {/* 1. Institutions */}
          <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md p-7 text-center">
            <img
              src={DownloadIcon}
              alt="Institutions issue certificates"
              className="h-10 w-10 mx-auto mb-4 transition-transform group-hover:scale-110"
            />
            <h3 className="font-semibold text-lg leading-snug">
              Institutions
              <br /> Issue Certificates
            </h3>
          </div>

          {/* 2. Employers */}
          <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md p-7 text-center">
            <img
              src={SendIcon}
              alt="Employers request access"
              className="h-10 w-10 mx-auto mb-4 transition-transform group-hover:scale-110"
            />
            <h3 className="font-semibold text-lg leading-snug">
              Employers
              <br /> Request Access
            </h3>
          </div>

          {/* 3. Applicants */}
          <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md p-7 text-center">
            <img
              src={CheckIcon}
              alt="Applicants approve request"
              className="h-10 w-10 mx-auto mb-4 transition-transform group-hover:scale-110"
            />
            <h3 className="font-semibold text-lg leading-snug">
              Applicants
              <br /> Approve Request
            </h3>
          </div>

          {/* 4. Verify */}
          <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md p-7 text-center">
            <img
              src={UserIcon}
              alt="Employers verify instantly"
              className="h-10 w-10 mx-auto mb-4 transition-transform group-hover:scale-110"
            />
            <h3 className="font-semibold text-lg leading-snug">
              Employers
              <br /> Verify Instantly
            </h3>
          </div>
        </div>
      </div>
    </section>
  );
}
