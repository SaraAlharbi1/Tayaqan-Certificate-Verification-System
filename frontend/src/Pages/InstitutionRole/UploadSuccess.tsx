// frontend/src/Pages/InstitutionRole/UploadSuccess.tsx
import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type SuccessState = {
  certificate_id?: number;
  txHash?: string;
  blockNumber?: number;
};

type CertDetail = {
  id: number;
  display_label: string | null;
  certificate_type?: string | null;
  issued_on: string | null;
  applicant_full_name?: string;
  applicant_national_id_plain?: string;
};

const EXPLORER_BASE = "https://sepolia.etherscan.io";

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

export default function UploadSuccess() {
  const location = useLocation();
  const { certificate_id, txHash, blockNumber } = (location.state || {}) as SuccessState;

  const [details, setDetails] = useState<CertDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!certificate_id) return;

    let abort = false;
    setLoading(true);
    setError(null);

    api<CertDetail>(`/certificates/institution/${certificate_id}/`, { method: "GET" })
      .then((data) => {
        if (!abort) setDetails(data);
      })
      .catch((err) => {
        if (!abort) setError(err?.userMessage || "Failed to load certificate details");
      })
      .finally(() => {
        if (!abort) setLoading(false);
      });

    return () => { abort = true; };
  }, [certificate_id]);

  return (
    <section className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 mb-6">
            <svg className="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
            Certificate{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Issued!
            </span>
          </h1>
          <p className="text-gray-600">Your certificate has been recorded on the blockchain</p>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-8">
          {/* Certificate Info */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Certificate Information</h2>
            </div>

            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</div>
            ) : details ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500 sm:w-32 shrink-0">Title</span>
                  <span className="text-sm font-semibold text-gray-900">{details.display_label || "—"}</span>
                </div>
                {details.certificate_type && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500 sm:w-32 shrink-0">Type</span>
                    <span className="text-sm font-semibold text-gray-900">{details.certificate_type}</span>
                  </div>
                )}
                {details.applicant_full_name && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500 sm:w-32 shrink-0">Issued To</span>
                    <span className="text-sm font-semibold text-gray-900">{details.applicant_full_name}</span>
                  </div>
                )}
                {details.applicant_national_id_plain && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-gray-100">
                    <span className="text-sm text-gray-500 sm:w-32 shrink-0">National ID</span>
                    <span className="text-sm font-mono font-semibold text-gray-900">{details.applicant_national_id_plain}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500 sm:w-32 shrink-0">Issue Date</span>
                  <span className="text-sm font-semibold text-gray-900">{formatDate(details.issued_on)}</span>
                </div>
                {certificate_id && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 py-3">
                    <span className="text-sm text-gray-500 sm:w-32 shrink-0">Certificate ID</span>
                    <span className="text-sm font-mono font-bold text-indigo-600">#{certificate_id}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No certificate details available</p>
            )}
          </div>

          {/* Blockchain Info */}
          <div className="p-6 bg-gray-50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Blockchain Record</h2>
            </div>

            <div className="space-y-4">
              {/* Transaction Hash */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Transaction Hash
                </label>
                {txHash ? (
                  <a
                    href={`${EXPLORER_BASE}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-indigo-600 hover:text-indigo-800 underline break-all"
                  >
                    {txHash}
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Not available</p>
                )}
              </div>

              {/* Block Number */}
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Block Number
                </label>
                {typeof blockNumber === "number" ? (
                  <a
                    href={`${EXPLORER_BASE}/block/${blockNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm text-indigo-600 hover:text-indigo-800 underline"
                  >
                    #{blockNumber.toLocaleString()}
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Not available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/institution/upload"
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Issue Another
          </Link>

          <Link
            to="/institution/certificates"
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View All
          </Link>

          <Link
            to="/institution"
            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}