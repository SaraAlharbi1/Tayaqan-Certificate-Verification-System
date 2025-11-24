// frontend/src/Pages/EmployerRole/CertificateDetails.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiBlob } from "@/lib/api";

/* ------------------------------------------------------------
   Types
------------------------------------------------------------- */
type RawCertificate = {
  id: number | string;
  title?: string | null;
  display_label?: string | null;
  certificate_type?: string | null;
  issuer?: string | null;
  institution_name?: string | null;
  issued_on?: string | null;
  file_hash?: string | null;
  tx_hash?: string | null;
  blockchain_tx_hash?: string | null;
  block_number?: number | null;
  revoke_tx_hash?: string | null;
  revoke_block_number?: number | null;
  revoked_at?: string | null;
  expiry_date?: string | null;
  is_expired?: boolean;
  is_active?: boolean;
};

type VerificationStatus = "CHECKING" | "ACTIVE" | "REVOKED" | "EXPIRED" | "INVALID";

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------- */
const EXPLORER_BASE = "https://sepolia.etherscan.io";

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/* ------------------------------------------------------------
   Components
------------------------------------------------------------- */
function StatusBadge({ status }: { status: VerificationStatus }) {
  const config = {
    CHECKING: { bg: "bg-gray-100", text: "text-gray-600", icon: "⏳", label: "Verifying..." },
    ACTIVE: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "✓", label: "Active" },
    REVOKED: { bg: "bg-red-100", text: "text-red-700", icon: "✕", label: "Revoked" },
    EXPIRED: { bg: "bg-yellow-100", text: "text-yellow-700", icon: "⏰", label: "Access Expired" },
    INVALID: { bg: "bg-orange-100", text: "text-orange-700", icon: "⚠", label: "Invalid" },
  };

  const { bg, text, icon, label } = config[status];

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${bg} ${text}`}>
      <span className="text-base">{icon}</span>
      {label}
    </span>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 sm:w-36 shrink-0">{label}</span>
      <span className={`text-sm font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-4 text-red-700 hover:text-red-900">✕</button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   Main Component
------------------------------------------------------------- */
export default function CertificateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<RawCertificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>("CHECKING");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Load certificate data
  useEffect(() => {
    const loadData = async () => {
      try {
        const cert = await api<RawCertificate>(`/access/employer/certificates/${id}/`);
        setData(cert);

        // Determine status
        if (cert.revoked_at) {
          setStatus("REVOKED");
        } else if (cert.is_expired) {
          setStatus("EXPIRED");
        } else if (cert.is_active) {
          setStatus("ACTIVE");
        } else {
          setStatus("INVALID");
        }
      } catch (e: any) {
        setError(e?.userMessage || "Failed to load certificate or access has been revoked");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // PDF handlers
  const handleOpenPdf = useCallback(async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      const blob = await apiBlob(`/access/employer/certificates/${id}/file/`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setActionErr("Could not open PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [id]);

  const handleDownloadPdf = useCallback(async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      const blob = await apiBlob(`/access/employer/certificates/${id}/file/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionErr("Could not download PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <section className="min-h-screen bg-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <section className="min-h-screen bg-white py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠</div>
            <h2 className="text-xl font-bold text-red-700 mb-2">Error Loading Certificate</h2>
            <p className="text-red-600 mb-4">{error || "Certificate not found or access revoked"}</p>
            <button onClick={() => navigate(-1)} className="text-indigo-600 hover:underline">
              ← Go Back
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isRevoked = status === "REVOKED";
  const isExpired = status === "EXPIRED";
  const canAccessPdf = status === "ACTIVE";
  const txHash = data.blockchain_tx_hash || data.tx_hash;

  return (
    <section className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Certificate{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Details
              </span>
            </h1>
            <p className="mt-1 text-gray-500">View certificate details and download PDF</p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {/* Errors */}
        {actionErr && <ErrorBanner message={actionErr} onDismiss={() => setActionErr(null)} />}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Status Header */}
          <div className={`px-6 py-4 border-b ${
            isRevoked ? "bg-red-50 border-red-200" : 
            isExpired ? "bg-yellow-50 border-yellow-200" :
            status === "ACTIVE" ? "bg-emerald-50 border-emerald-200" : 
            "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isRevoked ? "bg-red-100" : isExpired ? "bg-yellow-100" : "bg-indigo-100"
                }`}>
                  <svg className={`w-6 h-6 ${isRevoked ? "text-red-600" : isExpired ? "text-yellow-600" : "text-indigo-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {data.title || data.display_label || "Certificate"}
                  </h2>
                  {data.certificate_type && (
                    <span className="text-sm text-gray-500">{data.certificate_type}</span>
                  )}
                </div>
              </div>
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Certificate Info */}
            <div className="space-y-1">
              <InfoRow label="Issued by" value={data.issuer || data.institution_name || "—"} />
              <InfoRow label="Issue Date" value={formatDate(data.issued_on)} />
              {data.expiry_date && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500 sm:w-36 shrink-0">Access Expires</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatDate(data.expiry_date)}
                    {isExpired && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">
                        Expired
                      </span>
                    )}
                  </span>
                </div>
              )}
              {data.revoked_at && (
                <InfoRow label="Revoked On" value={formatDate(data.revoked_at)} />
              )}
            </div>

            {/* Blockchain Transaction */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              {/* Show revocation info if revoked, otherwise show issuance info */}
              {isRevoked && data.revoke_tx_hash ? (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Revocation Transaction
                  </label>
                  <a
                    href={`${EXPLORER_BASE}/tx/${data.revoke_tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-red-600 hover:text-red-800 underline break-all"
                  >
                    {data.revoke_tx_hash}
                  </a>
                </div>
              ) : (
                <>
                  {/* Issuance Transaction */}
                  {txHash && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Blockchain Transaction
                      </label>
                      <a
                        href={`${EXPLORER_BASE}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-indigo-600 hover:text-indigo-800 underline break-all"
                      >
                        {txHash}
                      </a>
                    </div>
                  )}

                  {/* Block Number */}
                  {data.block_number && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Block Number
                      </label>
                      <a
                        href={`${EXPLORER_BASE}/block/${data.block_number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-sm text-indigo-600 hover:text-indigo-800 underline"
                      >
                        #{data.block_number.toLocaleString()}
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-3">
              {canAccessPdf ? (
                <>
                  <button
                    onClick={handleOpenPdf}
                    disabled={pdfLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    {pdfLoading ? "Opening..." : "View PDF"}
                  </button>

                  <button
                    onClick={handleDownloadPdf}
                    disabled={pdfLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {pdfLoading ? "Downloading..." : "Download PDF"}
                  </button>
                </>
              ) : (
                <span className="inline-flex items-center gap-2 px-4 py-2.5 text-gray-500 text-sm">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {isRevoked ? "Certificate is revoked" : isExpired ? "Access has expired" : "PDF not available"}
                </span>
              )}

              <button
                onClick={() => navigate(-1)}
                className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
