/**
 * SuccessPending.tsx
 * Generic "Thank you / Pending Approval" page.
 * Role comes from the URL: /signup/success/:role
 */

import { Link, useParams } from "react-router-dom";

const ROLE_LABEL: Record<string, string> = {
  institution: "Institution",
  hr: "HR Employee",
  employee: "Employee",
};

export default function SuccessPending() {
  const { role = "" } = useParams<{ role: string }>();

  const label = ROLE_LABEL[role?.toLowerCase()] ?? "Account";

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="flex items-start justify-between mb-6">
            <h1 className="text-3xl font-extrabold leading-tight">
              Thank you for <span className="text-brand-600">registration</span>
            </h1>
          </div>

          <div className="flex items-center gap-3 text-lg font-medium mb-2">
            <span className="text-green-600 text-2xl">✔</span>
            <span>
              Your {label} account has been created{" "}
              <span className="text-brand-600">successfully</span>.
            </span>
          </div>

          <p className="text-gray-800 font-semibold mb-6">
            To ensure security, all {label.toLowerCase()} accounts must be verified by our admin team before issuing certificates.
          </p>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-600 text-sm font-medium">
              Pending Approval
            </span>
            <span className="animate-spin text-rose-500">⏳</span>
          </div>

        </div>
      </div>
    </section>
  );
}
