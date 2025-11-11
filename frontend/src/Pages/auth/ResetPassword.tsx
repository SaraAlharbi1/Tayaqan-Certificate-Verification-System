// src/Pages/auth/ResetPasswordPage.tsx
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const uid = params.get("uid") || "";
  const token = params.get("token") || "";
  const validLink = useMemo(() => Boolean(uid && token), [uid, token]);

  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validLink || loading) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/password-reset/confirm/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token, new_password: pwd }),
      });
      if (res.ok) {
        setOk(true);
        setTimeout(() => nav("/login"), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        setErr(data?.detail || "Invalid or expired link.");
      }
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pt-0 pb-6">
      <div className="mx-auto max-w-xl px-6 pt-8 pb-10">
        {!validLink ? (
          <>
            {/* Invalid Link State */}
            <div className="mb-6 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Invalid{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Reset Link
                </span>
              </h1>
              <p className="mt-1 text-gray-500">The link is missing or expired</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-8 text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-gray-700 mb-6">
                  Please request a new password reset link.
                </p>
                <Link
                  to="/forgot-password"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Request New Link
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Choose a New{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Password
                </span>
              </h1>
              <p className="mt-1 text-gray-500">Use at least 8 characters</p>
            </div>

            {/* Success Banner */}
            {ok && (
              <div className="mb-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-emerald-700">Password updated! Redirecting to login…</p>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {err && (
              <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{err}</p>
                </div>
              </div>
            )}

            {/* Form Card */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <form onSubmit={submit} className="p-6 space-y-5" noValidate>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-gray-700">
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    minLength={8}
                    required
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Back to Sign In
                  </Link>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || pwd.length < 8}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving…
                      </>
                    ) : (
                      "Save New Password"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>
    </section>
  );
}