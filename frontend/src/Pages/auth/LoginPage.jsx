// src/Pages/auth/LoginPage.jsx
import { useState } from "react";
import { login } from "@/lib/auth";
import { useNavigate, Link } from "react-router-dom";

/**
 * LoginPage
 *
 * Provides a card-centered login form.
 * - Email + password fields
 * - Error handling and loading state
 * - Redirects to home ("/") after successful login
 * - Link to "Forgot Password" (placeholder) and role-based signup
 */
export default function LoginPage() {
  const nav = useNavigate();

  // Local state for form fields and UI feedback
  const [email, setEmail] = useState("demo@example.com"); // default demo email
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);          // tracks loading state
  const [err, setErr] = useState(null);                   // error message

  // Handle form submit
  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      // Call the login helper from lib/auth
      await login(email, password);
      // Redirect to homepage after login
      nav("/", { replace: true });
    } catch (e) {
      // Capture and show error
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="bg-gradient-to-b from-white to-surface">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-10 flex justify-center">
        {/* Card container */}
        <div className="card w-full max-w-2xl p-6 md:p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl md:text-4xl font-bold">
              Welcome <span className="text-brand-600">Back.</span>
            </h1>
            <p className="text-muted mt-1">
              <span className="text-brand-600 font-semibold">Sign in</span> to your account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email field */}
            <label className="block">
              <span className="block text-sm font-medium mb-1">Email / ID</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-brand-600/40 px-4 py-2 outline-none focus:ring-2 focus:ring-brand-600/40"
                placeholder="demo@example.com"
              />
            </label>

            {/* Password field */}
            <label className="block">
              <span className="block text-sm font-medium mb-1">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-brand-600/20 px-4 py-2 outline-none focus:ring-2 focus:ring-brand-600/40"
                placeholder="Enter your password"
              />
            </label>

            {/* Error message */}
            {err && <div className="text-rose-600 text-sm">{err}</div>}

            {/* Actions: Forgot password + Sign in */}
            <div className="flex justify-between items-center text-sm">
              <Link to="#" className="text-brand-600 hover:text-brand-700">
                Forgot Password
              </Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>

          {/* Footer: Role-based signup */}
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
