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
    } catch {}
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
      // Login and get tokens
      await login(normalizeIdentifier(identifier), password);

      let role = "";
      try {
        // Fetch user profile
        const profile = await me();
        role = normRole(profile?.role);

        // Save full profile to localStorage
        localStorage.setItem("profile", JSON.stringify(profile));

        // Legacy support - minimal user data
        localStorage.setItem("user", JSON.stringify({ id: profile?.id, role }));
      } catch (profileErr) {
        console.error("Failed to fetch profile:", profileErr);
      }

      // Check if there's a redirect location
      const from = (location.state?.from as any)?.pathname;
      if (from) {
        nav(from, { replace: true });
        return;
      }

      // Role-based navigation
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

      // Default fallback
      nav("/", { replace: true });
    } catch (err: any) {
      setError(await getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="pt-0 pb-6">
      <div className="mx-auto max-w-xl px-6 pt-8 pb-10">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Back
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Sign in to your account</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <form onSubmit={onSubmit} className="p-6 space-y-5" noValidate>
            {/* Email or National ID */}
            <div>
              <label
                htmlFor="identifier"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Email or National ID
              </label>
              <input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (error) setError(null);
                }}
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                placeholder="demo@example.com or 1234567890"
                autoComplete="username"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Forgot Password?
              </Link>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}