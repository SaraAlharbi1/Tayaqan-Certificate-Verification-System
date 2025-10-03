// src/Pages/auth/LoginPage.tsx
import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { login, me } from "@/lib/auth";

const normalizeIdentifier = (s: string) => s.replace(/[^\w@.+-]/g, "").trim();
const normRole = (r: unknown) =>
  String(r || "")
    .replace(/^role[_-]?/i, "")
    .replace(/^_/, "")
    .toLowerCase();

// Extract most helpful backend error message (DRF-compatible)
async function getErrorMessage(err: any): Promise<string> {
  const dataFromAxios = err?.response?.data;
  if (dataFromAxios) {
    const msg =
      dataFromAxios.detail ??
      dataFromAxios.non_field_errors?.[0] ??
      (Array.isArray(Object.values(dataFromAxios)) &&
        (Object.values(dataFromAxios) as any).flat?.()?.[0]);
    if (msg) return String(msg);
  }

  if (err instanceof Response) {
    try {
      const data = await err.json();
      const msg =
        data?.detail ??
        data?.non_field_errors?.[0] ??
        (Array.isArray(Object.values(data)) &&
          (Object.values(data) as any).flat?.()?.[0]);
      if (msg) return String(msg);
    } catch {
      /* ignore */
    }
  }

  return err?.message || "Login failed. Please check your credentials.";
}

export default function LoginPage() {
  const nav = useNavigate();
  const location = useLocation() as { state?: { from?: Location } };

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1) Authenticate
      await login(normalizeIdentifier(identifier), password);

      // 2) Get profile → persist role so RoleRoute can allow access
      let role = "";
      try {
        const profile = await me();
        role = normRole(profile?.role);
        localStorage.setItem("user", JSON.stringify({ id: profile?.id, role }));
      } catch {
        /* proceed without role; fallback below */
      }

      // 3) If user came from protected route, return there
      const from = (location.state?.from as any)?.pathname;
      if (from) {
        nav(from, { replace: true });
        return;
      }

      // 4) Route by role
      if (role === "institution") {
        nav("/institution", { replace: true });
        return;
      }
      if (role === "employer") {
        nav("/employer", { replace: true });
        return;
      }
      if (role === "applicant") {
        nav("/applicant", { replace: true });
        return;
      }

      // 5) Fallback
      nav("/", { replace: true });
    } catch (err: any) {
      setError(await getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-gradient-to-b from-white to-surface -mt-6 md:-mt-10">
      <div className="mx-auto max-w-6xl px-6 pt-8 md:pt-10 pb-14 md:pb-16 flex justify-center">
        <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm">
          {/* Heading (brand gradient + underline to match site style) */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              Welcome{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                back
              </span>
              .
            </h1>
            <div className="flex justify-center mt-2">
              <span className="block h-1 w-16 bg-brand-600 rounded-full" />
            </div>
            <p className="text-muted mt-3">
              <span className="text-brand-600 font-semibold">Sign in</span> to your account
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <label className="block">
              <span className="block text-sm font-medium mb-1">Email or National ID</span>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full h-11 rounded-xl border border-gray-200 px-4 outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="demo@example.com or 1234567890"
                autoComplete="username"
                inputMode="text"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-medium mb-1">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full h-11 rounded-xl border border-gray-200 px-4 outline-none focus:ring-2 focus:ring-indigo-500/30"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </label>

            {error && (
              <div
                className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-rose-700 text-sm"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            <div className="flex justify-between items-center text-sm">
              <Link to="/forgot-password" className="text-brand-600 hover:text-brand-700">
                Forgot Password
              </Link>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                aria-busy={loading}
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center text-sm text-muted">
            Don’t have an account?{" "}
            <Link to="/signup" className="text-brand-600 hover:text-brand-700">
              Choose your role to sign up
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
