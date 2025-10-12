// src/pages/institution/UploadSuccess.tsx
import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type SuccessState = {
  id?: string | number;   // DB id of the created certificate (for details page)
  txHash?: string;
  blockNumber?: number;
  cid?: string;
};

type CertDetail = {
  id: number;
  display_label: string | null;
  issued_on: string | null;      // ISO date from Django (YYYY-MM-DD) or null
  serial_number: string | null;
};

export default function UploadSuccess() {
  const { applicantId = "" } = useParams<{ applicantId: string }>();
  const location = useLocation();
  const { id, txHash, blockNumber, cid } = (location.state || {}) as SuccessState;

  const certId = useMemo(
    () => (typeof id === "number" ? id : id ? Number(id) : undefined),
    [id]
  );

  const [details, setDetails] = useState<CertDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!certId) return;
    let abort = false;
    setLoading(true);
    setLoadError(null);

    api<CertDetail>(`/certificates/${encodeURIComponent(String(certId))}/`, {
      method: "GET",
    })
      .then((data) => {
        if (!abort) setDetails(data);
      })
      .catch((err: any) => {
        if (abort) return;
        const msg = err?.userMessage || err?.message || "Failed to load certificate.";
        setLoadError(String(msg));
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });

    return () => {
      abort = true;
    };
  }, [certId]);

  const niceDate = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        <div className="auth-card">
          <h1 className="text-3xl font-extrabold leading-tight mb-6">
            Certificate <span className="text-brand-600">Uploaded</span>
          </h1>

          {!certId && (
            <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Couldn’t find the new certificate id (page refreshed?). Open the dashboard to see recent uploads.
            </div>
          )}

          <div className="flex items-center gap-3 text-lg font-medium mb-4">
            <span className="text-green-600 text-2xl">✔</span>
            <span>
              Certificate for applicant{" "}
              <span className="text-brand-600">{applicantId || "—"}</span>{" "}
              has been uploaded <span className="text-brand-600">successfully</span>.
            </span>
          </div>

          {(txHash || cid || typeof blockNumber === "number") && (
            <div className="mb-6 rounded-xl border border-black/5 bg-gray-50 px-4 py-3 text-sm">
              <div className="font-semibold text-gray-800 mb-2">Details</div>
              <ul className="space-y-1 text-gray-700">
                {cid && (
                  <li>
                    <span className="font-medium">CID:</span>{" "}
                    <span className="break-all">{cid}</span>
                  </li>
                )}
                {txHash && (
                  <li>
                    <span className="font-medium">Transaction:</span>{" "}
                    <span className="break-all">{txHash}</span>
                  </li>
                )}
                {typeof blockNumber === "number" && !Number.isNaN(blockNumber) && (
                  <li>
                    <span className="font-medium">Block:</span>{" "}
                    <span>{blockNumber}</span>
                  </li>
                )}
              </ul>
            </div>
          )}

          {certId && (
            <div className="mb-6 rounded-xl border border-black/5 bg-gray-50 px-4 py-3 text-sm">
              <div className="font-semibold text-gray-800 mb-2">Certificate Info</div>
              {loading ? (
                <div className="text-gray-600">Loading certificate…</div>
              ) : loadError ? (
                <div className="text-red-600">Couldn’t load certificate: {loadError}</div>
              ) : (
                <ul className="space-y-1 text-gray-700">
                  <li>
                    <span className="font-medium">Title:</span>{" "}
                    <span>{details?.display_label || "—"}</span>
                  </li>
                  <li>
                    <span className="font-medium">Issued Date:</span>{" "}
                    <span>{niceDate(details?.issued_on ?? null)}</span>
                  </li>
                  <li>
                    <span className="font-medium">Serial Number:</span>{" "}
                    <span>{details?.serial_number || "—"}</span>
                  </li>
                </ul>
              )}
            </div>
          )}

          <p className="text-gray-800 font-semibold mb-6">
            You can now return to the dashboard or upload another certificate.
          </p>

          <div className="flex gap-3">
            <Link to="/institution/upload" className="btn btn-primary">Upload Another</Link>
            <Link to="/institution/certificates" className="btn btn-outline">Go to Dashboard</Link>
            {certId != null && !Number.isNaN(certId) && (
              <Link
                to={`/institution/certificates/${encodeURIComponent(String(certId))}`}
                className="btn btn-outline"
              >
                View this Certificate
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
