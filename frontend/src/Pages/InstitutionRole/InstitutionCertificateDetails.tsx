import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, apiBlob } from "@/lib/api";

/* ------------------------------------------------------------
   Types
------------------------------------------------------------- */
type RawCertificate = {
  id: number | string;
  display_label?: string | null;
  certificate_type?: string | null;
  issued_on?: string | null;
  applicant_full_name?: string | null;
  applicant_national_id_plain?: string | null;
  applicant_wallet_address?: string | null;
  institution_name?: string | null;
  institution_id?: string | null;
  file_hash?: string | null;
  applicant_id_hash?: string | null;
  contract_address?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
  revoke_tx_hash?: string | null;
  revoke_block_number?: number | null;
  revoked_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type BlockchainVerification = {
  file_hash: string;
  exists: boolean;
  is_revoked: boolean;
  issue_date: number;
  certificate_type?: string;
};

type VerificationStatus = "CHECKING" | "ACTIVE" | "REVOKED" | "NOT_FOUND";

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
    ACTIVE: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "✓", label: "Verified on Blockchain" },
    REVOKED: { bg: "bg-red-100", text: "text-red-700", icon: "✕", label: "Revoked" },
    NOT_FOUND: { bg: "bg-orange-100", text: "text-orange-700", icon: "⚠", label: "Not Found" },
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
export default function InstitutionCertificateDetails() {
  const { id } = useParams<{ id: string }>();

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
        const cert = await api<RawCertificate>(`/certificates/institution/${id}/`);
        setData(cert);

        if (cert.file_hash) {
          verifyOnBlockchain(cert.file_hash);
        } else {
          setStatus("NOT_FOUND");
        }
      } catch (e: any) {
        setError(e?.userMessage || "Failed to load certificate");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  // Blockchain verification
  const verifyOnBlockchain = async (fileHash: string) => {
    try {
      const resp = await api<{ results: BlockchainVerification[] }>(
        "/certificates/institution/verify-batch/",
        {
          method: "POST",
          body: JSON.stringify({ file_hashes: [fileHash] }),
        }
      );

      const result = resp.results?.[0];

      if (!result || !result.exists) {
        setStatus("NOT_FOUND");
      } else if (result.is_revoked) {
        setStatus("REVOKED");
      } else {
        setStatus("ACTIVE");
      }
    } catch (e) {
      console.error("Blockchain verification failed:", e);
      setStatus("NOT_FOUND");
    }
  };

  // ✅ FIXED: PDF handlers using apiBlob
  const handleOpenPdf = useCallback(async () => {
    if (!id) return;
    setPdfLoading(true);
    setActionErr(null);
    try {
      const blob = await apiBlob(`/certificates/institution/${id}/file/`);
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
    setActionErr(null);
    try {
      const blob = await apiBlob(`/certificates/institution/${id}/file/`);
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
            <p className="text-red-600 mb-4">{error || "Certificate not found"}</p>
            <Link to="/institution/certificates" className="text-indigo-600 hover:underline">
              ← Back to Certificates
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const isRevoked = status === "REVOKED" || !!data.revoked_at;

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
            <p className="mt-1 text-gray-500">View certificate and blockchain verification</p>
          </div>
          <Link
            to="/institution/certificates"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Errors */}
        {actionErr && <ErrorBanner message={actionErr} onDismiss={() => setActionErr(null)} />}

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Status Header */}
          <div className={`px-6 py-4 border-b ${
            isRevoked ? "bg-red-50 border-red-200" : 
            status === "ACTIVE" ? "bg-emerald-50 border-emerald-200" : 
            "bg-gray-50 border-gray-200"
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isRevoked ? "bg-red-100" : "bg-indigo-100"
                }`}>
                  <svg className={`w-6 h-6 ${isRevoked ? "text-red-600" : "text-indigo-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{data.display_label || "Certificate"}</h2>
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
              <InfoRow label="Institution" value={data.institution_name || "—"} />
              <InfoRow label="Applicant" value={data.applicant_full_name || "—"} />
              <InfoRow label="National ID" value={data.applicant_national_id_plain || "—"} mono />
              <InfoRow label="Issue Date" value={formatDate(data.issued_on)} />
              {data.revoked_at && (
                <InfoRow label="Revoked On" value={formatDate(data.revoked_at)} />
              )}
            </div>

            {/* Blockchain Transaction */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              {/* Issuance Transaction */}
              {data.tx_hash && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Issuance Transaction
                  </label>
                  <a
                    href={`${EXPLORER_BASE}/tx/${data.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-indigo-600 hover:text-indigo-800 underline break-all"
                  >
                    {data.tx_hash}
                  </a>
                </div>
              )}

              {/* Issuance Block */}
              {data.block_number && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Issuance Block
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

              {/* Revocation Info (if revoked) */}
              {isRevoked && data.revoke_tx_hash && (
                <div className="mt-4 bg-red-50 rounded-xl p-4 border border-red-200">
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
              )}
            </div>
          </div>

          {/* Actions Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleOpenPdf}
                disabled={pdfLoading || isRevoked}
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
                disabled={pdfLoading || isRevoked}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {pdfLoading ? "Downloading..." : "Download PDF"}
              </button>

              <Link
                to="/institution/certificates"
                className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
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