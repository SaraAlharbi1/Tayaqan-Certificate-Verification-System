// frontend/src/Pages/EmployerRole/CreateAccessRequest.tsx
import { useMemo, useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";

export default function CreateAccessRequest() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [applicantData, setApplicantData] = useState<{full_name: string; email?: string} | null>(null);
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
      
      // Debounce the API call
      const timer = setTimeout(async () => {
        try {
          // Changed: Use the accounts endpoint to verify applicant
          const response = await api<{full_name: string; email?: string}>(
            `/accounts/applicants/verify/${trimmed}/`
          );
          if (!cancel) {
            setApplicantData(response);
            setApplicantError("");
            setFetchingApplicant(false);
          }
        } catch (e: any) {
          if (!cancel) {
            let errorMessage = "Applicant not found";
            
            if (e?.userMessage) {
              errorMessage = e.userMessage;
            } else if (e?.response?.data?.detail) {
              errorMessage = e.response.data.detail;
            } else if (e?.response?.data?.message) {
              errorMessage = e.response.data.message;
            } else if (e?.message) {
              errorMessage = e.message;
            }
            
            setApplicantError(errorMessage);
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
  if (!looksLikeId || !applicantData) {
    if (!applicantData && looksLikeId) {
      setError("Cannot send request: Applicant not found");
    }
    return;
  }
  
  try {
    setSubmitting(true);
    setError("");
    setSuccess(false);
    
    // FIX: Change back to applicant_national_id to match backend
    await api("/access/employer/requests/", {
      method: "POST",
      body: JSON.stringify({ applicant_national_id: trimmed }),
    });
    
    setSuccess(true);
    setQuery("");
    
    setTimeout(() => {
      navigate("/employer/access");
    }, 1500);
    
  } catch (e: any) {
    // Better error display
    let errorMessage = "Failed to create request. Please try again.";
    
    if (e?.data?.applicant_national_id) {
      errorMessage = e.data.applicant_national_id[0];
    } else if (e?.data?.detail) {
      errorMessage = e.data.detail;
    } else if (e?.userMessage) {
      errorMessage = e.userMessage;
    } else if (e?.message) {
      errorMessage = e.message;
    }
    
    setError(errorMessage);
    setSubmitting(false);
  }
};

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Create Access{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Request
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Enter the applicant's national ID to request access</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Request sent successfully!</p>
                <p className="text-sm text-emerald-700 mt-1">Redirecting to access requests...</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">Failed to create request</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Input Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="p-6">
            <div className="mb-4">
              <label htmlFor="search" className="mb-2 block text-sm font-semibold text-gray-700">
                Applicant National ID
              </label>
              <input
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Enter 10-digit National ID"
                disabled={submitting || success}
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {trimmed && (
                <div className="flex items-center mt-2">
                  <p className={`text-sm font-medium ${looksLikeId ? "text-emerald-600" : "text-red-600"}`}>
                    {looksLikeId ? "✓ Valid format" : "✗ Invalid format (must be 10 digits)"}
                  </p>
                </div>
              )}
            </div>

            {/* Applicant Preview Card */}
            {looksLikeId && (
              <div className="mb-4">
                {fetchingApplicant && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-600">Verifying applicant...</p>
                  </div>
                )}

                {!fetchingApplicant && applicantData && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 p-2 bg-emerald-100 rounded-lg">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-emerald-800">Applicant Found</p>
                        <p className="text-base font-bold text-emerald-900 mt-1">{applicantData.full_name}</p>
                        {applicantData.email && (
                          <p className="text-sm text-emerald-700 mt-0.5">{applicantData.email}</p>
                        )}
                      </div>
                      <svg className="w-6 h-6 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                )}

                {!fetchingApplicant && applicantError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold text-red-800">Applicant Not Found</p>
                      <p className="text-sm text-red-700 mt-1">{applicantError}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">About Access Requests</p>
                <p>When you send a request, the applicant will be notified and can choose to approve or decline sharing their certificates with you.</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
            <Link 
              to="/employer/access" 
              className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!looksLikeId || !applicantData || submitting || success}
              className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors ${
                !looksLikeId || !applicantData || submitting || success
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
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