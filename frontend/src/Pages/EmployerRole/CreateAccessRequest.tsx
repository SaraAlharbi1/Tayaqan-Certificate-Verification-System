// frontend/src/Pages/EmployerRole/CreateAccessRequest.tsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";

interface ApplicantData {
  full_name: string;
  email?: string;
}

export default function CreateAccessRequest() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [applicantData, setApplicantData] = useState<ApplicantData | null>(null);
  const [fetchingApplicant, setFetchingApplicant] = useState(false);
  const [applicantError, setApplicantError] = useState<string>("");

  const trimmed = query.trim();
  const looksLikeId = useMemo(() => /^\d{10}$/.test(trimmed), [trimmed]);

  // Fetch applicant data when valid ID is entered
  useEffect(() => {
    let cancel = false;

    if (looksLikeId && trimmed) {
      setFetchingApplicant(true);
      setApplicantError("");
      setApplicantData(null);

      const timer = setTimeout(async () => {
        try {
          const response = await api<ApplicantData>(`/accounts/applicants/verify/${trimmed}/`);
          if (!cancel) {
            setApplicantData(response);
            setApplicantError("");
            setFetchingApplicant(false);
          }
        } catch (e: any) {
          if (!cancel) {
            setApplicantError(e?.userMessage || e?.message || "Applicant not found");
            setApplicantData(null);
            setFetchingApplicant(false);
          }
        }
      }, 500);

      return () => {
        cancel = true;
        clearTimeout(timer);
      };
    } else {
      setApplicantData(null);
      setApplicantError("");
      setFetchingApplicant(false);
    }
  }, [looksLikeId, trimmed]);

  const handleSubmit = async () => {
    if (!looksLikeId || !applicantData) return;

    try {
      setSubmitting(true);
      setError("");

      await api("/access/employer/requests/", {
        method: "POST",
        body: JSON.stringify({ applicant_national_id: trimmed }),
      });

      setSuccess(true);
      setQuery("");
      setTimeout(() => navigate("/employer/access"), 1500);
    } catch (e: any) {
      let errorMessage = "Failed to create request";
      if (e?.data?.applicant_national_id) errorMessage = e.data.applicant_national_id[0];
      else if (e?.data?.detail) errorMessage = e.data.detail;
      else if (e?.userMessage) errorMessage = e.userMessage;
      setError(errorMessage);
      setSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              New{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Request
              </span>
            </h1>
            <p className="mt-1 text-gray-500">Request access to an applicant's certificates</p>
          </div>
          <Link
            to="/employer/access"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-800">Request sent successfully!</p>
                <p className="text-sm text-emerald-700">Redirecting to access requests...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-semibold text-red-800">Failed to create request</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            {/* Step Indicator */}
            <div className="mb-8">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm ${
                  trimmed ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  1
                </div>
                <div className="flex-1 h-1 bg-gray-200 rounded">
                  <div className={`h-full bg-indigo-600 rounded transition-all ${looksLikeId ? 'w-1/2' : 'w-0'}`}></div>
                </div>
                <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm ${
                  applicantData ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  2
                </div>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs text-gray-500">Enter ID</span>
                <span className="text-xs text-gray-500">Verify & Send</span>
              </div>
            </div>

            {/* Input */}
            <div className="mb-6">
              <label htmlFor="nationalId" className="block text-sm font-semibold text-gray-700 mb-2">
                Applicant National ID
              </label>
              <div className="relative">
                <input
                  id="nationalId"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="Enter 10-digit National ID"
                  disabled={submitting || success}
                  className="w-full h-14 pl-5 pr-12 rounded-xl border-2 border-gray-200 bg-gray-50 text-lg font-mono tracking-wider outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:opacity-50"
                />
                {trimmed && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {looksLikeId ? (
                      <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              {trimmed && !looksLikeId && (
                <p className="mt-2 text-sm text-red-600">Please enter exactly 10 digits</p>
              )}
            </div>

            {/* Applicant Preview */}
            {looksLikeId && (
              <div className="mb-6">
                {fetchingApplicant && (
                  <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-gray-600 font-medium">Verifying applicant...</p>
                  </div>
                )}

                {!fetchingApplicant && applicantData && (
                  <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-emerald-700 font-bold text-xl">
                          {applicantData.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Applicant Found</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">{applicantData.full_name}</p>
                        {applicantData.email && (
                          <p className="text-sm text-gray-600 mt-0.5">{applicantData.email}</p>
                        )}
                      </div>
                      <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                )}

                {!fetchingApplicant && applicantError && (
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-red-800">Applicant Not Found</p>
                        <p className="text-sm text-red-700 mt-0.5">{applicantError}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">How it works</p>
                <p>The applicant will receive a notification and can choose which certificates to share with you.</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
            <Link
              to="/employer/access"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!looksLikeId || !applicantData || submitting || success}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending...
                </>
              ) : success ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Sent!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Request
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}