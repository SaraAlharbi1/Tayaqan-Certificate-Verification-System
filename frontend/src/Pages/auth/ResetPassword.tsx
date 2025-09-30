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
    <section className="bg-gradient-to-b from-white to-surface min-h-[70vh]">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10 flex justify-center">
        <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
          {!validLink ? (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold">
                  Invalid <span className="text-brand-600">reset link</span>
                </h1>
                <p className="text-muted mt-1">
                  The link is missing or expired. Request a new one.
                </p>
              </div>
              <div className="text-center">
                <Link to="/forgot-password" className="text-brand-600 hover:text-brand-700">
                  Request new link
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-3xl md:text-4xl font-bold">
                  Choose <span className="text-brand-600">a new password</span>
                </h1>
                <p className="text-muted mt-1">Use at least 8 characters.</p>
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate>
                <label className="block">
                  <span className="block text-sm font-medium mb-1">New password</span>
                  <input
                    type="password"
                    minLength={8}
                    required
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    className="w-full rounded-xl border border-brand-600/20 px-4 py-2 outline-none focus:ring-2 focus:ring-brand-600/40"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>

                {err && (
                  <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700 text-sm">
                    {err}
                  </div>
                )}
                {ok && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-700 text-sm">
                    Password updated. Redirecting…
                  </div>
                )}

                <div className="flex justify-between items-center text-sm">
                  <Link to="/login" className="text-brand-600 hover:text-brand-700">
                    Back to sign in
                  </Link>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium border border-brand-600 bg-brand-600 text-white disabled:opacity-60"
                    disabled={loading || pwd.length < 8}
                    aria-busy={loading}
                  >
                    {loading ? "Saving…" : "Save new password"}
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
