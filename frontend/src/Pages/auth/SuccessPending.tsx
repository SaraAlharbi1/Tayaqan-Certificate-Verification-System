// src/pages/auth/SuccessPending.tsx
import { Link, useParams } from "react-router-dom";
import { Clock } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  institution: "Institution",
  hr: "HR Employee",
  employee: "Employee",
};

export default function SuccessPending() {
  const { role = "" } = useParams<{ role: string }>();
  const label = ROLE_LABEL[role?.toLowerCase()] ?? "Account";

  return (
    <section className="pt-0 pb-6">
      <div className="mx-auto max-w-2xl px-6 pt-8 pb-10">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Thank You for{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Registering
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Your account has been created successfully</p>
        </div>

        {/* Success Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm mb-6">
          <div className="border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-emerald-900">Account Created Successfully</h3>
                <p className="text-sm text-emerald-700">Your {label} account is ready</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="text-gray-700 leading-relaxed mb-6">
              To ensure security, all {label.toLowerCase()} accounts must be verified by our admin team before you can start using the platform. You'll receive an email notification once your account has been approved.
            </p>

            <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900">Pending Admin Approval</p>
                <p className="text-xs text-yellow-700 mt-0.5">This usually takes 1-2 business days</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
          >
            Go to Login
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            You can sign in once your account is approved
          </p>
        </div>
      </div>
    </section>
  );
}