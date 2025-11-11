// src/pages/institution/UploadSuccess.tsx
import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle, FileText, Upload, Home } from "lucide-react";
import { api } from "@/lib/api";

type SuccessState = {
  id?: string | number;
  txHash?: string;
  blockNumber?: number;
  cid?: string;
};

type CertDetail = {
  id: number;
  display_label: string | null;
  issued_on: string | null;
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

    // CHANGED: use /institution/certificates/:id/
    api<CertDetail>(`/institution/certificates/${encodeURIComponent(String(certId))}/`, {
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
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Certificate{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Uploaded Successfully
            </span>
          </h1>
          <p className="mt-1 text-gray-500">
            Your certificate has been issued and recorded on the blockchain
          </p>
        </div>

        {!certId && (
          <div className="mb-6 rounded-xl border-2 border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900">Certificate ID Not Found</p>
                <p className="mt-1 text-sm text-yellow-700">
                  Couldn't find the new certificate ID (page may have been refreshed). Check the certificates dashboard.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 rounded-2xl border-emerald-200 border-2 bg-gradient-to-r from-emerald-50 to-green-50 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-emerald-500">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-emerald-900 mb-2">Upload Complete!</h2>
              <p className="text-emerald-800 text-base leading-relaxed">
                Certificate for applicant <span className="font-semibold">{applicantId || "—"}</span> has been issued.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {(txHash || cid || typeof blockNumber === "number") && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-900">Blockchain Details</h3>
                <p className="mt-1 text-sm text-gray-600">Immutable proof of issuance</p>
              </div>
              <div className="p-6 space-y-4">
                {cid && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Content ID (CID)</label>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800 font-mono break-all">
                      {cid}
                    </div>
                  </div>
                )}
                {txHash && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Hash</label>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800 font-mono break-all">
                      {txHash}
                    </div>
                  </div>
                )}
                {typeof blockNumber === "number" && !Number.isNaN(blockNumber) && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Block Number</label>
                    <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-800 font-mono">
                      {blockNumber}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {certId && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-900">Certificate Information</h3>
                <p className="mt-1 text-sm text-gray-600">Details about the issued certificate</p>
              </div>
              <div className="p-6">
                {loading ? (
                  <div className="flex items-center gap-3 text-gray-600">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading certificate details…
                  </div>
                ) : loadError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <p className="font-semibold">Error loading certificate</p>
                    <p className="mt-1">{loadError}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Certificate Title</label>
                      <p className="text-gray-900">{details?.display_label || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Issue Date</label>
                      <p className="text-gray-900">{niceDate(details?.issued_on ?? null)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Serial Number</label>
                      <p className="text-gray-900 font-mono text-sm">{details?.serial_number || "—"}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Link to="/institution/upload" className="group relative h-full rounded-xl bg-white border-2 border-purple-200 hover:border-purple-300 shadow-sm transition-all duration-300 hover:shadow-lg p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 to-purple-100/0 group-hover:from-purple-50/50 group-hover:to-purple-100/30 transition-all duration-300 rounded-xl"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100 text-purple-600 mb-3 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-purple-600 transition-colors">Upload Another</h3>
              <p className="text-sm text-gray-600 mt-1">Issue more certificates</p>
            </div>
          </Link>

          <Link to="/institution/certificates" className="group relative h-full rounded-xl bg-white border-2 border-indigo-200 hover:border-indigo-300 shadow-sm transition-all duration-300 hover:shadow-lg p-6 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-100/0 group-hover:from-indigo-50/50 group-hover:to-indigo-100/30 transition-all duration-300 rounded-xl"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">View All Certificates</h3>
              <p className="text-sm text-gray-600 mt-1">Browse issued certificates</p>
            </div>
          </Link>

          {certId != null && !Number.isNaN(certId) ? (
            <Link to={`/institution/certificates/${encodeURIComponent(String(certId))}`} className="group relative h-full rounded-xl bg-white border-2 border-emerald-200 hover:border-emerald-300 shadow-sm transition-all duration-300 hover:shadow-lg p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-100/0 group-hover:from-emerald-50/50 group-hover:to-emerald-100/30 transition-all duration-300 rounded-xl"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 mb-3 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">View This Certificate</h3>
                <p className="text-sm text-gray-600 mt-1">See full details</p>
              </div>
            </Link>
          ) : (
            <Link to="/institution" className="group relative h-full rounded-xl bg-white border-2 border-gray-200 hover:border-gray-300 shadow-sm transition-all duration-300 hover:shadow-lg p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-50/0 to-gray-100/0 group-hover:from-gray-50/50 group-hover:to-gray-100/30 transition-all duration-300 rounded-xl"></div>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 text-gray-600 mb-3 group-hover:bg-gray-600 group-hover:text-white transition-all duration-300">
                  <Home className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-gray-600 transition-colors">Dashboard</h3>
                <p className="text-sm text-gray-600 mt-1">Return to home</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
