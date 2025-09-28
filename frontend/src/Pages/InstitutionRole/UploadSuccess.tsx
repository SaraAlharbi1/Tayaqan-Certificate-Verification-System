// src/pages/institution/UploadSuccess.tsx
// -----------------------------------------------------------------------------
// UploadSuccess
// - Simple confirmation screen shown after a successful certificate upload.
// - Reads :applicantId from the route params and displays it in the message.
// - Provides primary/secondary actions: upload another or go to dashboard.
// - Uses the same "auth-*" layout classes for consistent look & spacing.
// -----------------------------------------------------------------------------

import { Link, useParams } from "react-router-dom";

export default function UploadSuccess() {
  // Read dynamic segment from the route: /institution/upload/success/:applicantId
  // If the param is missing, fall back to an empty string and render "—".
  const { applicantId = "" } = useParams<{ applicantId: string }>();

  return (
    // Outer section uses the standard hero spacing used across auth-like pages
    <section className="auth-hero">
      <div className="auth-wrap">
        {/* White card container */}
        <div className="auth-card">
          {/* Title */}
          <h1 className="text-3xl font-extrabold leading-tight mb-6">
            Certificate <span className="text-brand-600">Uploaded</span>
          </h1>

          {/* Success line with check icon and highlighted applicant id */}
          <div className="flex items-center gap-3 text-lg font-medium mb-4">
            <span className="text-green-600 text-2xl">✔</span>
            <span>
              Certificate for applicant{" "}
              <span className="text-brand-600">{applicantId || "—"}</span>{" "}
              has been uploaded{" "}
              <span className="text-brand-600">successfully</span>.
            </span>
          </div>

          {/* Short next-steps hint */}
          <p className="text-gray-800 font-semibold mb-6">
            You can now return to the dashboard or upload another certificate.
          </p>

          {/* Primary/secondary actions */}
          <div className="flex gap-3">
            {/* Primary: start another upload flow */}
            <Link to="/institution/upload" className="btn btn-primary">
              Upload Another
            </Link>

            {/* Secondary: back to list/dashboard */}
            <Link to="/institution/dashboard" className="btn btn-outline">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
