import { Link, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type SuccessState = {
  certificate_id?: number;
  txHash?: string;
  blockNumber?: number;
};

type CertDetail = {
  id: number;
  display_label: string | null;
  issued_on: string | null;
  applicant_full_name?: string;
  applicant_national_id_plain?: string;
};

// ✅ Etherscan helpers
const ETHERSCAN_BASE = "https://etherscan.io";
const txUrl = (hash: string) => `${ETHERSCAN_BASE}/tx/${hash}`;
const blockUrl = (num: number) => `${ETHERSCAN_BASE}/block/${num}`;

export default function UploadSuccess() {
  const location = useLocation();
  const { certificate_id, txHash, blockNumber } =
    (location.state || {}) as SuccessState;

  const certId = useMemo(
    () => (certificate_id ? Number(certificate_id) : undefined),
    [certificate_id]
  );

  const [details, setDetails] = useState<CertDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!certId) return;
    let abort = false;
    setLoading(true);
    setError(null);

    api<CertDetail>(`/certificates/institution/${certId}/`, { method: "GET" })
      .then((data) => {
        if (!abort) {
          console.log("✅ Certificate loaded:", data);
          setDetails(data);
        }
      })
      .catch((err) => {
        console.error("❌ Failed to load certificate:", err);
        if (!abort) {
          setError(err?.userMessage || "Failed to load certificate details");
        }
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
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <section className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Certificate Issued Successfully!
          </h1>
          <p className="text-gray-600">
            Your certificate has been recorded on the blockchain
          </p>
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden mb-6">
          
          {/* Certificate Info */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Certificate Information
            </h2>

            {loading ? (
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4"></div>
              </div>
            ) : error ? (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                {error}
              </div>
            ) : details ? (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Title</label>
                  <p className="text-base font-semibold text-gray-900">
                    {details.display_label || "—"}
                  </p>
                </div>

                {details.applicant_full_name && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Issued To</label>
                    <p className="text-base text-gray-900">
                      {details.applicant_full_name}
                    </p>
                  </div>
                )}

                {details.applicant_national_id_plain && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">National ID</label>
                    <p className="text-base font-mono text-gray-900">
                      {details.applicant_national_id_plain}
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-600">Issue Date</label>
                  <p className="text-base text-gray-900">
                    {niceDate(details.issued_on)}
                  </p>
                </div>

                {certId && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Certificate ID</label>
                    <p className="text-base font-mono text-indigo-600 font-semibold">
                      #{certId}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No certificate details available
              </p>
            )}
          </div>

          {/* Blockchain Info */}
          <div className="p-6 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Blockchain Details
            </h2>

            <div className="space-y-3">
              {txHash ? (
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    Transaction Hash
                  </label>
                  <div className="bg-white rounded border border-gray-200 px-3 py-2">
                    <a
                      href={txUrl(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono break-all text-indigo-600 hover:text-indigo-800 underline"
                    >
                      {txHash}
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    Transaction Hash
                  </label>
                  <div className="bg-white rounded border border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">Not available</p>
                  </div>
                </div>
              )}

              {typeof blockNumber === "number" ? (
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    Block Number
                  </label>
                  <div className="bg-white rounded border border-gray-200 px-3 py-2">
                    <a
                      href={blockUrl(blockNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-indigo-600 hover:text-indigo-800 underline"
                    >
                      #{blockNumber}
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium text-gray-600 block mb-1">
                    Block Number
                  </label>
                  <div className="bg-white rounded border border-gray-200 px-3 py-2">
                    <p className="text-sm text-gray-500">Not available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/institution/upload"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Upload Another
          </Link>

          <Link
            to="/institution/certificates"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            View All
          </Link>

          <Link
            to="/institution"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </Link>
        </div>

      </div>
    </section>
  );
}