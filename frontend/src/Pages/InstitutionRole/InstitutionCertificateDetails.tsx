import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, apiBlob } from "@/lib/api";

/* ------------------------------------------------------------
   Backend Response Type
------------------------------------------------------------- */
type RawInstitutionCert = {
  id: number | string;

  display_label?: string | null;
  issued_on?: string | null;

  applicant_full_name?: string | null;
  applicant_national_id_plain?: string | null;

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

/* ------------------------------------------------------------
   Blockchain Verification Types
------------------------------------------------------------- */
type BlockchainStatus = {
  exists: boolean;
  revoked: boolean;
  certificateType?: string;
  issueDate?: number;
};

/* ------------------------------------------------------------
   Normalized Certificate Type
------------------------------------------------------------- */
type CertDetail = {
  id: number | string;

  title: string;
  issueDate?: string | null;

  issuerName?: string | null;
  issuerId?: string | null;

  applicantName?: string | null;
  applicantNID?: string | null;

  fileHash?: string | null;
  applicantIdHash?: string | null;

  contractAddress?: string | null;

  txHash?: string | null;
  blockNumber?: number | null;

  revokeTxHash?: string | null;
  revokeBlockNumber?: number | null;
  revokedAt?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
};

/* ------------------------------------------------------------
   Helpers
------------------------------------------------------------- */
const ETHERSCAN_BASE = "https://etherscan.io";

const normalizeTx = (v?: string | null) => {
  if (!v) return null;
  const hex = v.startsWith("0x") ? v.slice(2) : v;
  if (/^[a-fA-F0-9]{64}$/.test(hex)) return "0x" + hex.toLowerCase();
  return null;
};

const normHash = (h?: string | null) => {
  if (!h) return "";
  return (h.startsWith("0x") ? h : "0x" + h).toLowerCase();
};

const isBlockNum = (v?: number | null) =>
  typeof v === "number" && Number.isInteger(v) && v >= 0;

const txUrl = (tx: string) => `${ETHERSCAN_BASE}/tx/${tx}`;
const blockUrl = (n: number) => `${ETHERSCAN_BASE}/block/${n}`;

/* ------------------------------------------------------------
   Normalizer
------------------------------------------------------------- */
function normalize(raw: RawInstitutionCert): CertDetail {
  return {
    id: raw.id,

    title: raw.display_label || "Certificate",
    issueDate: raw.issued_on || null,

    issuerName: raw.institution_name || null,
    issuerId: raw.institution_id || null,

    applicantName: raw.applicant_full_name || null,
    applicantNID: raw.applicant_national_id_plain || null,

    fileHash: raw.file_hash || null,
    applicantIdHash: raw.applicant_id_hash || null,

    contractAddress: raw.contract_address || null,

    txHash: raw.tx_hash || null,
    blockNumber: raw.block_number ?? null,

    revokeTxHash: raw.revoke_tx_hash || null,
    revokeBlockNumber: raw.revoke_block_number ?? null,
    revokedAt: raw.revoked_at || null,

    createdAt: raw.created_at || null,
    updatedAt: raw.updated_at || null,
  };
}

/* ------------------------------------------------------------
   Status Badge Component
------------------------------------------------------------- */
function StatusBadge({
  status,
}: {
  status: "CHECKING" | "ACTIVE" | "REVOKED" | "INVALID";
}) {
  const styles = {
    CHECKING: "bg-gray-400 text-white",
    ACTIVE: "bg-emerald-500 text-white",
    REVOKED: "bg-red-500 text-white",
    INVALID: "bg-orange-500 text-white",
  };

  const labels = {
    CHECKING: "Verifying...",
    ACTIVE: "ACTIVE",
    REVOKED: "REVOKED",
    INVALID: "INVALID",
  };

  const icons = {
    CHECKING: "⏳",
    ACTIVE: "✓",
    REVOKED: "✕",
    INVALID: "⚠",
  };

  return (
    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold ${styles[status]}`}>
      <span>{icons[status]}</span>
      {labels[status]}
    </span>
  );
}

/* ------------------------------------------------------------
   Error Banner
------------------------------------------------------------- */
function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 text-red-700 hover:text-red-900"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   Main Component
------------------------------------------------------------- */
export default function InstitutionCertificateDetails() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<CertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [status, setStatus] =
    useState<"CHECKING" | "ACTIVE" | "REVOKED" | "INVALID">("CHECKING");

  /* ---------------- Load Data ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const raw = await api<RawInstitutionCert>(
          `/certificates/institution/${encodeURIComponent(id!)}/`
        );

        const normalized = normalize(raw);
        setData(normalized);

        if (normalized.fileHash) verifyOnChain(normalized.fileHash);
      } catch (e: any) {
        setErr(e?.userMessage || "Failed to load certificate");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* ---------------- Blockchain Verification ---------------- */
  const verifyOnChain = async (fileHash: string) => {
    try {
      const normalized = normHash(fileHash);

      const resp = await api<any>("/certificates/institution/verify-batch/", {
        method: "POST",
        body: JSON.stringify({ file_hashes: [normalized] }),
      });

      const items = resp?.results || resp;
      const result = items?.[0];

      if (!result || !result.exists) {
        setStatus("INVALID");
      } else if (result.is_revoked || result.revoked) {
        setStatus("REVOKED");
      } else {
        setStatus("ACTIVE");
      }
    } catch {
      setStatus("INVALID");
    }
  };

  /* ---------------- PDF Actions ---------------- */
  const openPdf = useCallback(async () => {
    if (!data) return;
    setPdfLoading(true);

    try {
      const blob = await apiBlob(`/certificates/institution/${data.id}/file/`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      setErr(e?.userMessage || "Failed to open PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [data]);

  const downloadPdf = useCallback(async () => {
    if (!data) return;
    setPdfLoading(true);

    try {
      const blob = await apiBlob(`/certificates/institution/${data.id}/file/`);
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificate_${data.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.userMessage || "Failed to download PDF");
    } finally {
      setPdfLoading(false);
    }
  }, [data]);

  /* ---------------- Render ---------------- */
  if (loading) {
    return (
      <section className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-gray-600">Loading…</div>
      </section>
    );
  }

  if (err && !data) {
    return (
      <section className="min-h-screen flex justify-center items-center px-4">
        <div className="max-w-md w-full">
          <ErrorBanner message={err} onDismiss={() => setErr(null)} />
          <Link
            to="/institution/certificates"
            className="btn btn-outline mt-4 w-full text-center block"
          >
            ← Back
          </Link>
        </div>
      </section>
    );
  }

  // ✅ Choose which transaction/block to show based on status
  const txNorm =
    status === "REVOKED"
      ? normalizeTx(data?.revokeTxHash)
      : normalizeTx(data?.txHash);

  const blockToShow =
    status === "REVOKED" ? data?.revokeBlockNumber : data?.blockNumber;

  const statusBarColor = {
    CHECKING: "bg-gray-50 border-gray-200",
    ACTIVE: "bg-emerald-50 border-emerald-100",
    REVOKED: "bg-red-50 border-red-200",
    INVALID: "bg-orange-50 border-orange-200",
  }[status];

  return (
    <section className="flex-grow min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Certificate{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Details
              </span>
            </h1>
            <p className="mt-1 text-gray-500">
              View certificate and blockchain verification
            </p>
          </div>

          <Link to="/institution/certificates" className="btn btn-outline">
            ← Back
          </Link>
        </div>

        {/* Errors */}
        {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          {/* Status bar */}
          <div className={`px-6 py-3 border-b ${statusBarColor}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm font-medium text-gray-600">
                Blockchain Status
              </span>
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8">
            {/* Title */}
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {data?.title || "Untitled Certificate"}
            </h2>

            {/* Issuer + Applicant */}
            <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm font-medium">Issued by:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {data?.issuerName || "—"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm font-medium">Applicant:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {data?.applicantName || "—"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm font-medium">National ID:</span>
                <span className="text-sm font-semibold text-gray-900 font-mono">
                  {data?.applicantNID || "—"}
                </span>
              </div>
            </div>

            {/* Issue Date */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Issue Date
              </label>
              <p className="text-sm md:text-base font-semibold text-gray-900">
                {data?.issueDate
                  ? new Date(data.issueDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </p>
            </div>

            {/* ✅ REVOKED: Show Revocation Info WITHOUT Date */}
            {status === "REVOKED" && (
              <div className="space-y-4">
                {/* Revocation Transaction */}
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                    Revocation Transaction
                  </label>

                  {txNorm ? (
                    <a
                      href={txUrl(txNorm)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs md:text-sm text-red-600 break-all underline hover:text-red-800"
                    >
                      {txNorm}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-gray-500">—</span>
                  )}
                </div>

                {/* Revocation Block */}
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                    Revocation Block
                  </label>

                  {isBlockNum(blockToShow) ? (
                    <a
                      href={blockUrl(blockToShow!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs md:text-sm text-red-600 underline hover:text-red-800"
                    >
                      {blockToShow}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-gray-500">
                      —
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* ✅ NOT REVOKED: Show Issuance Info */}
            {status !== "REVOKED" && (
              <div className="space-y-4">
                {/* Issuance Transaction */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                    Issuance Transaction
                  </label>

                  {txNorm ? (
                    <a
                      href={txUrl(txNorm)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs md:text-sm text-indigo-600 break-all underline hover:text-indigo-800"
                    >
                      {txNorm}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-gray-500">—</span>
                  )}
                </div>

                {/* Issuance Block */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                    Issuance Block
                  </label>

                  {isBlockNum(blockToShow) ? (
                    <a
                      href={blockUrl(blockToShow!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs md:text-sm text-indigo-600 underline hover:text-indigo-800"
                    >
                      {blockToShow}
                    </a>
                  ) : (
                    <span className="text-sm font-semibold text-gray-500">
                      —
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="bg-gray-50 px-5 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={openPdf}
              disabled={pdfLoading}
              className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-colors duration-200"
            >
              {pdfLoading ? "Opening…" : "Open PDF"}
            </button>

            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="flex-1 sm:flex-none bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-colors duration-200"
            >
              {pdfLoading ? "Downloading…" : "Download PDF"}
            </button>

            <Link
              to="/institution/certificates"
              className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors duration-200 text-center"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
