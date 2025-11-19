import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, apiBlob } from "@/lib/api";

/* ============================================================================ */
/* Types */
/* ============================================================================ */

type CertDetail = {
  id: number | string;
  title?: string | null;
  issuerName?: string | null;
  issueDate?: string | null;
  fileHash?: string | null;

  tx_hash?: string | null;
  block_number?: number | null;

  revoke_tx_hash?: string | null;
  revoke_block_number?: number | null;
  revoked_at?: string | null;

  applicant?: {
    national_id_plain?: string | null;
  } | null;
};

/* ============================================================================ */
/* Helpers */
/* ============================================================================ */

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between">
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-4 text-red-700 hover:text-red-900">
          ✕
        </button>
      )}
    </div>
  );
}

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
    <span
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs md:text-sm font-semibold ${styles[status]}`}
    >
      <span>{icons[status]}</span>
      {labels[status]}
    </span>
  );
}

const ETHERSCAN_BASE = "https://etherscan.io";

const normalizeTx = (v?: string | null) => {
  if (!v) return null;
  const hex = v.startsWith("0x") ? v.slice(2) : v;
  return /^[a-fA-F0-9]{64}$/.test(hex) ? "0x" + hex.toLowerCase() : null;
};

const normHash = (h?: string | null) => {
  if (!h) return "";
  return (h.startsWith("0x") ? h : "0x" + h).toLowerCase();
};

const isBlockNum = (v?: number | null) => typeof v === "number" && v >= 0;

const txUrl = (tx: string) => `${ETHERSCAN_BASE}/tx/${tx}`;
const blockUrl = (n: number) => `${ETHERSCAN_BASE}/block/${n}`;

/* ============================================================================ */
/* Component */
/* ============================================================================ */

export default function MyApplicantCertificateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<CertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [status, setStatus] =
    useState<"CHECKING" | "ACTIVE" | "REVOKED" | "INVALID">("CHECKING");

  /* ------------------ Load Data ------------------ */
  useEffect(() => {
    (async () => {
      try {
        const res = await api<any>(`/certificates/my/${id}/`);

        const certData: CertDetail = {
          id: res.id,
          title: res.display_label ?? null,
          issuerName: res.institution_name ?? null,
          issueDate: res.issued_on ?? null,
          fileHash: res.file_hash ?? null,
          tx_hash: res.tx_hash || null,
          block_number: res.block_number ?? null,
          revoke_tx_hash: res.revoke_tx_hash || null,
          revoke_block_number: res.revoke_block_number ?? null,
          revoked_at: res.revoked_at || null,
          applicant: {
            national_id_plain: res.applicant_national_id_plain ?? null,
          },
        };

        setData(certData);

        if (certData.fileHash) {
          verifyOnChain(certData.fileHash);
        } else {
          setStatus("INVALID");
        }
      } catch {
        setErr("Failed to load certificate");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  /* ------------------ Blockchain Verification ------------------ */
  const verifyOnChain = async (fileHash: string) => {
    try {
      const normalized = normHash(fileHash);

      const resp = await api<any>("/certificates/my/verify-batch/", {
        method: "POST",
        body: JSON.stringify({ file_hashes: [normalized] }),
      });

      const items = resp?.results || resp;
      const result = items?.[0];

      if (!result || !result.exists) setStatus("INVALID");
      else if (result.is_revoked || result.revoked) setStatus("REVOKED");
      else setStatus("ACTIVE");
    } catch {
      setStatus("INVALID");
    }
  };

  /* ------------------ PDF Actions ------------------ */
  const openPdf = useCallback(async () => {
    if (!id) return;
    try {
      const blob = await apiBlob(`/certificates/my/${id}/file/`);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setActionErr("Could not open PDF.");
    }
  }, [id]);

  const downloadPdf = useCallback(async () => {
    if (!id) return;
    try {
      const blob = await apiBlob(`/certificates/my/${id}/file/`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setActionErr("Could not download PDF.");
    }
  }, [id]);

  /* ------------------ Render ------------------ */

  if (loading)
    return (
      <section className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-gray-600">Loading…</div>
      </section>
    );

  if (!data)
    return (
      <section className="p-8">
        <ErrorBanner message={err || "Not found"} />
        <button onClick={() => navigate(-1)} className="btn btn-outline mt-3">
          ← Back
        </button>
      </section>
    );

  const txNorm =
    status === "REVOKED"
      ? normalizeTx(data.revoke_tx_hash)
      : normalizeTx(data.tx_hash);

  const blockToShow =
    status === "REVOKED"
      ? data.revoke_block_number
      : data.block_number;

  const statusBarColor = {
    CHECKING: "bg-gray-50 border-gray-200",
    ACTIVE: "bg-emerald-50 border-emerald-100",
    REVOKED: "bg-red-50 border-red-200",
    INVALID: "bg-orange-50 border-orange-200",
  }[status];

  /* ------------------ UI ------------------ */

  return (
    <section className="flex-grow min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Certificate{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Details
              </span>
            </h1>
            <p className="mt-1 text-gray-500">View and download your certificate</p>
          </div>

          <Link to="/applicant/certificates" className="btn btn-outline">
            ← Back
          </Link>
        </div>

        {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
        {actionErr && (
          <ErrorBanner message={actionErr} onDismiss={() => setActionErr(null)} />
        )}

        <div className="rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className={`px-6 py-3 border-b ${statusBarColor}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm font-medium text-gray-600">
                Blockchain Status
              </span>
              <StatusBadge status={status} />
            </div>
          </div>

          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {data.title || "Untitled Certificate"}
            </h2>

            <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm font-medium">Issued by:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {data.issuerName || "—"}
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-600">
                <span className="text-sm font-medium">National ID:</span>
                <span className="text-sm font-semibold text-gray-900 font-mono">
                  {data.applicant?.national_id_plain || "—"}
                </span>
              </div>
            </div>

            <div className="mb-6 pb-6 border-b border-gray-200">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Issue Date
              </label>
              <p className="text-sm md:text-base font-semibold text-gray-900">
                {data.issueDate
                  ? new Date(data.issueDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </p>
            </div>

            {/* ------------------ CONDITIONAL VIEW ------------------ */}

            {status === "REVOKED" ? (
              /* ========== SHOW ONLY REVOKE INFO ========== */
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
                      className="font-mono text-xs md:text-sm text-red-600 underline break-all"
                    >
                      {txNorm}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">—</span>
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
                      className="font-mono text-xs md:text-sm text-red-600 underline"
                    >
                      {blockToShow}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">—</span>
                  )}
                </div>
              </div>
            ) : (
              /* ========== SHOW NORMAL ISSUANCE INFO ========== */
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
                      className="font-mono text-xs md:text-sm text-indigo-600 underline break-all"
                    >
                      {txNorm}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">—</span>
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
                      className="font-mono text-xs md:text-sm text-indigo-600 underline"
                    >
                      {blockToShow}
                    </a>
                  ) : (
                    <span className="font-mono text-xs">—</span>
                  )}
                </div>

              </div>
            )}

          </div>

          <div className="bg-gray-50 px-5 py-4 border-t border-gray-200 flex gap-3">
            <button
              onClick={openPdf}
              disabled={pdfLoading}
              className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-6 rounded-lg"
            >
              {pdfLoading ? "Opening…" : "Open PDF"}
            </button>

            <button
              onClick={downloadPdf}
              disabled={pdfLoading}
              className="flex-1 sm:flex-none bg-gray-700 hover:bg-gray-800 text-white font-semibold py-2.5 px-6 rounded-lg"
            >
              {pdfLoading ? "Downloading…" : "Download PDF"}
            </button>

            <Link
              to="/applicant/certificates"
              className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
