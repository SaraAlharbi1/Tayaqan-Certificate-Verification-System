// src/pages/institution/UploadSuccess.tsx
import { Link, useParams } from "react-router-dom";

export default function UploadSuccess() {
  const { applicantId = "" } = useParams<{ applicantId: string }>();

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="text-3xl font-extrabold leading-tight mb-6">
            Certificate <span className="text-brand-600">Uploaded</span>
          </h1>

          <div className="flex items-center gap-3 text-lg font-medium mb-4">
            <span className="text-green-600 text-2xl">✔</span>
            <span>
              Certificate for applicant{" "}
              <span className="text-brand-600">{applicantId || "—"}</span>{" "}
              has been uploaded{" "}
              <span className="text-brand-600">successfully</span>.
            </span>
          </div>

          <p className="text-gray-800 font-semibold mb-6">
            You can now return to the dashboard or upload another certificate.
          </p>

          <div className="flex gap-3">
            <Link to="/institution/upload" className="btn btn-primary">
              Upload Another
            </Link>
            <Link to="/institution/dashboard" className="btn btn-outline">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
