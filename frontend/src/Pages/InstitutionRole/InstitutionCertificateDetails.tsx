// src/Pages/InstitutionRole/InstitutionCertificateDetails.tsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, apiBlob } from "@/lib/api";

/* ----------------------------- Types ----------------------------- */
type RawInstitutionCert = {
  id: number | string;

  // display/meta (institution serializer variants)
  display_label?: string | null;
  title?: string | null;
  issued_on?: string | null;      // YYYY-MM-DD
  issueDate?: string | null;      // alt key
  serial_number?: string | null;
  serial?: string | null;

  // issuer variants
  issuerName?: string | null;
  issuer_name?: string | null;
  issuer?: { name?: string | null } | null;
  institution_name?: string | null;
  institution?: { name?: string | null } | null;

  // applicant variants
  applicant_full_name?: string | null;
  applicant_name?: string | null;
  applicant_national_id_plain?: string | null;
  applicant_national_id?: string | null;
  applicant?: {
    full_name?: string | null;
    name?: string | null;
    national_id_plain?: string | null;
    national_id?: string | null;
  } | null;

  // chain/meta
  status?: string | null; // "ACTIVE" | "REVOKED" | ...
  tx_hash?: string | null;
  block_number?: number | null;
  revoke_tx_hash?: string | null;
  revoke_block_number?: number | null;

  // backend-only for verify-batch
  file_hash?: string | null;
};

type CertDetail = {
  id: number | string;
  title?: string | null;
  issuerName?: string | null;
  issueDate?: string | null; // YYYY-MM-DD
  serial?: string | null;

  // chain/meta
  status?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
  revoke_tx_hash?: string | null;
  revoke_block_number?: number | null;

  applicant?: {
    id?: number;
    name?: string | null;
    national_id_plain?: string | null;
  } | null;

  // keep for verify-batch only (not rendered)
  file_hash?: string | null;
};

type ChainVerify = {
  fileHash: string;
  exists: boolean;
  revoked: boolean;
  issuedAt?: number;
  applicantIdHash?: string | null;
};

type TxInfo = {
  issuedTx?: string | null;
  issuedBlock?: number | null;
  revokeTx?: string | null;
  revokeBlock?: number | null;

  // optional extras from backend
  tx?: string | null;
  block?: number | null;
};

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div
      className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start justify-between"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-4 text-red-700 hover:text-red-900" aria-label="Dismiss error">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

/* ------------ normalize institution payload → applicant page shape ------------ */
function normalize(raw: RawInstitutionCert): CertDetail {
  const title = raw.display_label ?? raw.title ?? "Untitled Certificate";
  const issueDate = raw.issueDate ?? raw.issued_on ?? null;
  const serial = raw.serial ?? raw.serial_number ?? null;
  const issuerName =
    raw.issuerName ??
    raw.issuer_name ??
    raw.institution_name ??
    raw.institution?.name ??
    raw.issuer?.name ??
    null;

  const applicantName =
    raw.applicant_full_name ?? raw.applicant_name ?? raw.applicant?.full_name ?? raw.applicant?.name ?? null;

  const applicantId =
    raw.applicant_national_id_plain ??
    raw.applicant_national_id ??
    raw.applicant?.national_id_plain ??
    raw.applicant?.national_id ??
    null;

  return {
    id: raw.id,
    title,
    issuerName,
    issueDate,
    serial,
    status: raw.status ?? null,
    tx_hash: raw.tx_hash ?? null,
    block_number: raw.block_number ?? null,
    revoke_tx_hash: raw.revoke_tx_hash ?? null,
    revoke_block_number: raw.revoke_block_number ?? null,
    applicant: { name: applicantName, national_id_plain: applicantId },
    file_hash: raw.file_hash ?? null,
  };
}

export default function InstitutionCertificateDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<CertDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setErr("No certificate ID provided");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) fetch base
        const base = await api<RawInstitutionCert>(`/institution/certificates/${encodeURIComponent(id)}/`, { method: "GET" });
        if (cancelled) return;
        const normalized = normalize(base);
        setData(normalized);

        // 2) optional: enrich tx from /tx-info if missing
        if (!normalized.tx_hash || !normalized.block_number || !normalized.revoke_tx_hash || !normalized.revoke_block_number) {
          try {
            const ti = await api<TxInfo>(`/institution/certificates/${encodeURIComponent(id)}/tx-info/`, { method: "GET" });
            if (!cancelled && ti) {
              setData((prev) =>
                prev
                  ? {
                      ...prev,
                      tx_hash: prev.tx_hash ?? ti.issuedTx ?? ti.tx ?? null,
                      block_number: prev.block_number ?? ti.issuedBlock ?? ti.block ?? null,
                      revoke_tx_hash: prev.revoke_tx_hash ?? ti.revokeTx ?? null,
                      revoke_block_number: prev.revoke_block_number ?? ti.revokeBlock ?? null,
                    }
                  : prev
              );
            }
          } catch {
            /* ignore */
          }
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.userMessage || e?.message || "Failed to load certificate details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const openPdf = useCallback(async () => {
    if (!id) return;
    setActionErr(null);
    setPdfLoading(true);
    try {
      const blob = await apiBlob(`/institution/certificates/${encodeURIComponent(id)}/file/`, { method: "GET" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        URL.revokeObjectURL(url);
        setActionErr("Pop-up blocked. Allow pop-ups for this site.");
      } else {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (e: any) {
      setActionErr(e?.userMessage || e?.message || "Could not open PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [id]);

  const downloadPdf = useCallback(async () => {
    if (!id) return;
    setActionErr(null);
    setPdfLoading(true);
    try {
      const blob = await apiBlob(`/institution/certificates/${encodeURIComponent(id)}/file/`, { method: "GET" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `certificate-${data?.serial || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e: any) {
      setActionErr(e?.userMessage || e?.message || "Could not download PDF.");
    } finally {
      setPdfLoading(false);
    }
  }, [id, data?.serial]);

  if (loading) {
    return (
      <section className="pt-0 pb-6">
        <div className="auth-wrap">
          <div className="auth-card flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Loading certificate details…</p>
          </div>
        </div>
      </section>
    );
  }

  if (err && !data) {
    return (
      <section className="pt-0 pb-6">
        <div className="auth-wrap">
          <div className="auth-card">
            <ErrorBanner message={err} onDismiss={() => setErr(null)} />
            <button className="btn btn-outline" onClick={() => navigate(-1)} aria-label="Go back">
              ← Back
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isRevoked = (data?.status || "").toUpperCase() === "REVOKED";
  const txToShow = isRevoked ? data?.revoke_tx_hash : data?.tx_hash;
  const blockToShow = isRevoked ? data?.revoke_block_number : data?.block_number;

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header — IDENTICAL STYLE TO APPLICANT PAGE */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Certificate{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Details
              </span>
            </h1>
            <p className="mt-1 text-gray-500">View and download certificate</p>
          </div>
          <Link to="/institution/certificates" className="btn btn-outline" aria-label="Back to list">
            ← Back
          </Link>
        </div>

        {err && <ErrorBanner message={err} onDismiss={() => setErr(null)} />}
        {actionErr && <ErrorBanner message={actionErr} onDismiss={() => setActionErr(null)} />}

        {/* Card — IDENTICAL CLASSES */}
        <div className="rounded-2xl bg-white shadow-lg border border-border overflow-hidden">
          {/* Status bar */}
          <div
            className={`px-6 md:px-8 py-3 ${
              isRevoked ? "bg-red-50 border-b-2 border-red-200" : "bg-emerald-50 border-b-2 border-emerald-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Blockchain Status</span>
              <span
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${
                  isRevoked ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                {data?.status || "UNKNOWN"}
              </span>
            </div>
          </div>

          {/* Body — IDENTICAL LAYOUT */}
          <div className="p-6 md:p-8">
            {/* Title + Issuer + National ID */}
            <div className="mb-5 pb-5 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">{data?.title || "Untitled Certificate"}</h2>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  <span className="text-base font-medium">Issued by: </span>
                  <span className="text-base font-bold text-gray-900 font-mono">{data?.issuerName || "—"}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  <span className="text-base font-medium">National ID: </span>
                  <span className="text-base font-bold text-gray-900 font-mono">
                    {data?.applicant?.national_id_plain ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid md:grid-cols-2 gap-5 mb-5 pb-5 border-b border-gray-200">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Serial Number
                </label>
                <p className="text-base font-semibold text-gray-900 font-mono break-all">{data?.serial || "—"}</p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Issue Date
                </label>
                <p className="text-base font-semibold text-gray-900">
                  {data?.issueDate
                    ? new Date(data.issueDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "—"}
                </p>
              </div>
            </div>

            {/* Blockchain section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
                <h3 className="text-base font-bold text-gray-900">Blockchain Verification</h3>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {isRevoked ? "Revocation Transaction" : "Issuance Transaction"}
                  </label>
                  {txToShow && /^0x[0-9a-fA-F]{10,}$/.test(txToShow) ? (
                    <a
                      href={`${ETHERSCAN_BASE}/tx/${txToShow}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-sm text-indigo-600 hover:text-indigo-800 hover:underline break-all leading-relaxed inline-flex items-center gap-1 group"
                    >
                      {txToShow}
                      <svg
                        className="w-3 h-3 flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  ) : (
                    <p className="font-mono text-sm text-gray-900 break-all leading-relaxed">{txToShow || "—"}</p>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {isRevoked ? "Revocation Block" : "Issuance Block"}
                  </label>
                  <p className="text-base font-semibold text-gray-900">
                    {blockToShow != null ? (
                      <a
                        href={`${ETHERSCAN_BASE}/block/${blockToShow}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-sm text-indigo-600 hover:text-indigo-800 hover:underline break-all"
                      >
                        {blockToShow}
                      </a>
                    ) : (
                      "—"
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer — IDENTICAL BUTTON STYLES */}
          <div className="bg-gray-50 px-5 py-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
                onClick={openPdf}
                disabled={pdfLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {pdfLoading ? "Opening…" : "Open PDF"}
              </button>

              <button
                className="flex-1 sm:flex-none bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 shadow-sm"
                onClick={downloadPdf}
                disabled={pdfLoading}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
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
      </div>
    </section>
  );
}
