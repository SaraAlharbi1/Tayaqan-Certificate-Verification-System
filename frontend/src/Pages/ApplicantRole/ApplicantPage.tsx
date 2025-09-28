// src/Pages/ApplicantRole/ApplicantPage.tsx
import { Link } from "react-router-dom";
import CertificateLogo from "@/assets/Educational-logo.png";

export default function ApplicantPage() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      {/* العنوان */}
      <h1 className="text-3xl md:text-4xl font-bold mb-10">
        Get Started <span className="text-indigo-700">Now.</span>
      </h1>

      {/* الكروت */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* My Certificates */}
        <div className="group rounded-2xl border border-black/5 bg-white shadow-md transition hover:-translate-y-1 hover:shadow-lg p-6 text-center">
          <img
            src={CertificateLogo}
            alt="Certificates"
            className="mx-auto mb-4 h-12 w-12"
          />
          <h3 className="text-xl font-bold text-indigo-900 mb-6">
            My Certificates
          </h3>
          <Link
            to="/applicant/certificates"
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            View
          </Link>
        </div>

        {/* Access Requests */}
        <div className="group rounded-2xl border border-black/5 bg-white shadow-md transition hover:-translate-y-1 hover:shadow-lg p-6 text-center">
          <img
            src={CertificateLogo}
            alt="Access Requests"
            className="mx-auto mb-4 h-12 w-12"
          />
          <h3 className="text-xl font-bold text-indigo-900 mb-6">
            Access Requests
          </h3>
          <Link
            to="/applicant/requests"
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            View
          </Link>
        </div>
      </div>
    </section>
  );
}
