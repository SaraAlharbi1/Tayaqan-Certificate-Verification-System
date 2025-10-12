// src/Pages/InstitutionRole/InstitutionCertificateDetails.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, apiBlob } from "@/lib/api";

/* ----------------------------- Types ----------------------------- */
type CertDetail = {
  id: number | string;
  display_label?: string | null;
  issued_on?: string | null;
  serial_number?: string | null;
  status?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
  revoke_tx_hash?: string | null;
  revoke_block_number?: number | null;
  applicant?: { id: string | number; name?: string | null; national_id?: string | null };
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
export default function InstitutionCertificateDetails() {
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
        const res = await api<CertDetail>(`/certificates/${encodeURIComponent(id!)}/`, { method: "GET" });
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
      const blob = await apiBlob(`/certificates/${encodeURIComponent(id)}/file/`, { method: "GET" });
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
            <p className="mt-1 text-gray-500">View and download certificate</p>
          </div>
          <Link to="/institution/certificates" className="btn btn-outline">
            ← Back
          </Link>
        </div>

        {actionErr && <ErrorBanner message={actionErr} />}

        {/* Main Card */}
        <div className="auth-card bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Status Bar */}
          <div className={`px-6 py-3 ${isRevoked ? "bg-red-50 border-b-2 border-red-200" : "bg-emerald-50 border-b-2 border-emerald-200"}`}>
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
          <div className="p-5">
            {/* Title & Applicant */}
            <div className="mb-5 pb-5 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {data.display_label || "Untitled Certificate"}
              </h2>
              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-base font-medium">{data.applicant?.name || "Unknown Applicant"}</span>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid md:grid-cols-2 gap-5 mb-5 pb-5 border-b border-gray-200">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  National ID
                </label>
                <p className="text-base font-semibold text-gray-900">{data.applicant?.national_id || "—"}</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Issue Date
                </label>
                <p className="text-base font-semibold text-gray-900">{data.issued_on || "—"}</p>
              </div>
              
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Serial Number
                </label>
                <p className="text-base font-semibold text-gray-900 font-mono">{data.serial_number || "—"}</p>
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
                to="/institution/certificates" 
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