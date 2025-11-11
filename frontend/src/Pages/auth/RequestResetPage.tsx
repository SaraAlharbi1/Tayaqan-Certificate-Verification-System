// src/Pages/auth/RequestResetPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";

export default function RequestResetPage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/password-reset/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) setDone(true);
      else setErr("Something went wrong. Try again.");
    } catch {
      setErr("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="pt-0 pb-6">
      <div className="mx-auto max-w-xl px-6 pt-8 pb-10">
        {done ? (
          <>
            {/* Success State */}
            <div className="mb-6 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Check Your{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Email
                </span>
              </h1>
              <p className="mt-1 text-gray-500">If the address exists, we sent a reset link</p>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-gray-700 mb-6">
                  Please check your inbox and follow the instructions to reset your password.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 text-center">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                Reset Your{" "}
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Password
                </span>
              </h1>
              <p className="mt-1 text-gray-500">Enter your email to receive a reset link</p>
            </div>

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
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    Back to Sign In
                  </Link>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending…
                      </>
                    ) : (
                      "Send Reset Link"
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