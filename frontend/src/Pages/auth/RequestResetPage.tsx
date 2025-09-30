// src/Pages/auth/RequestResetPage.tsx
import { useState } from "react";
import { Link } from "react-router-dom";

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
    <section className="bg-gradient-to-b from-white to-surface min-h-[70vh]">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10 flex justify-center">
        <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
          {done ? (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold">
                  Check <span className="text-brand-600">your email</span>
                </h1>
                <p className="text-muted mt-1">
                  If the address exists, we sent a reset link.
                </p>
              </div>
              <div className="text-center">
                <Link to="/login" className="text-brand-600 hover:text-brand-700">
                  Back to sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold">
                  Reset <span className="text-brand-600">your password</span>
                </h1>
                <p className="text-muted mt-1">
                  Enter your account email to receive a reset link.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate>
                <label className="block">
                  <span className="block text-sm font-medium mb-1">Email address</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-brand-600/40 px-4 py-2 outline-none focus:ring-2 focus:ring-brand-600/40"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>

                {err && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700 text-sm">
                    {err}
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <Link to="/login" className="text-brand-600 hover:text-brand-700">
                    Back to sign in
                  </Link>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium border border-brand-600 bg-brand-600 text-white disabled:opacity-60"
                    disabled={loading}
                    aria-busy={loading}
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
