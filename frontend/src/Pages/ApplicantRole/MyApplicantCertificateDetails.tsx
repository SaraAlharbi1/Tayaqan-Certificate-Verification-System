// src/Pages/ApplicantRole/MyApplicantCertificateDetails.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, apiBlob } from "@/lib/api";

/* ----------------------------- Types ----------------------------- */
type CertDetail = {
  id: number | string;
  title?: string | null;
  issuerName?: string | null;
  issueDate?: string | null;    // YYYY-MM-DD
  serial?: string | null;
  status?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
  revoke_tx_hash?: string | null;
  revoke_block_number?: number | null;
};

/* ----------------------------- UI helpers ----------------------------- */
function truncateMiddle(v: string, head = 12, tail = 12) {
  if (!v) return "—";
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}

/* ----------------------------- Page ----------------------------- */
export default function MyApplicantCertificateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<CertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api<CertDetail>(`/my/certificates/${encodeURIComponent(id!)}/`, { method: "GET" });
        if (!cancel) {
          setData(res);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancel) {
          setErr(e?.userMessage || e?.message || "Failed to load certificate.");
          setLoading(false);
        }
      }
    })();
    return () => { cancel = true; };
  }, [id]);

  const openPdf = async () => {
    if (!id) return;
    try {
      setActionErr(null);
      setOpening(true);
      const blob = await apiBlob(`/my/certificates/${encodeURIComponent(id)}/file/`, { method: "GET" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      setActionErr(e?.userMessage || e?.message || "Could not open PDF.");
    } finally {
      setOpening(false);
    }
  };

  if (loading) {
    return (
      <section className="auth-wrap">
        <div className="auth-card">Loading…</div>
      </section>
    );
  }

  if (err || !data) {
    return (
      <section className="auth-wrap">
        <div className="auth-card">
          <ErrorBanner message={err || "Not found"} />
          <button className="btn btn-outline" onClick={() => navigate(-1)}>Back</button>
        </div>
      </section>
    );
  }

  const isRevoked = (data.status || "").toUpperCase() === "REVOKED";
  const chainTitle = isRevoked ? "Revocation Transaction" : "Issuance Transaction";
  const txToShow = isRevoked ? data.revoke_tx_hash : data.tx_hash;
  const blockToShow = isRevoked ? data.revoke_block_number : data.block_number;

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Certificate Details
              </span>
            </h1>
            <p className="mt-1 text-gray-500">View and download your certificate</p>
          </div>
          <Link to="/applicant/certificates" className="btn btn-outline">
            ← Back
          </Link>
        </div>

        {actionErr && <ErrorBanner message={actionErr} />}

        {/* Main Card */}
        <div className="rounded-2xl bg-white shadow-lg border border-border overflow-hidden">
          {/* Status Bar */}
          <div className={`px-6 md:px-8 py-3 ${isRevoked ? "bg-red-50 border-b-2 border-red-200" : "bg-emerald-50 border-b-2 border-emerald-200"}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Certificate Status</span>
              <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${
                isRevoked ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
              }`}>
                <span className="h-2 w-2 rounded-full bg-white" />
                {data.status}
              </span>
            </div>
          </div>

          {/* Certificate Info */}
          <div className="p-6 md:p-8">
            {/* Title & Issuer */}
            <div className="mb-5 pb-5 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {data.title || "Untitled Certificate"}
              </h2>
              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-base font-medium">{data.issuerName || "Unknown Issuer"}</span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid md:grid-cols-2 gap-5 mb-5 pb-5 border-b border-gray-200">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Issue Date
                </label>
                <p className="text-base font-semibold text-gray-900">{data.issueDate || "—"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Serial Number
                </label>
                <p className="text-base font-semibold text-gray-900 font-mono">{data.serial || "—"}</p>
              </div>
            </div>

            {/* Blockchain Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="text-base font-bold text-gray-900">Blockchain Verification</h3>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {chainTitle}
                  </label>
                  <p className="font-mono text-sm text-gray-900 break-all leading-relaxed">
                    {txToShow || "—"}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {isRevoked ? "Revocation Block" : "Issuance Block"}
                  </label>
                  <p className="text-base font-semibold text-gray-900">{blockToShow ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="bg-gray-50 px-5 py-3 border-t border-gray-200">
            <div className="flex gap-3">
              <button 
                className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm" 
                onClick={openPdf} 
                disabled={opening}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {opening ? "Opening…" : "Open PDF"}
              </button>
              <Link 
                to="/applicant/certificates" 
                className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors duration-200"
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}