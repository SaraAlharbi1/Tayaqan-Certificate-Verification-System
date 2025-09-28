/**
 * SignupApplicant.jsx (plain JS)
 *
 * Route: /signup/applicant
 * On success → navigate to Applicant Home (e.g., /applicant or /applicant/dashboard)
 */

import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";

// ---------- Validation ----------
const phoneRegex = /^(\+?\d{8,15})$/;           // + optional, 8–15 digits
const nationalIdRegex = /^\d{10}$/;             // e.g., 10 digits (adjust to your rule)

const schema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Enter a valid email"),
    nationalId: z.string().regex(nationalIdRegex, "Enter a valid National ID (10 digits)"),
    phone: z.string().regex(phoneRegex, "Enter a valid phone number (8–15 digits, optional +)"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must include at least one letter")
      .regex(/\d/, "Password must include at least one number")
      .regex(/[!@#$%^&*()[\]{}\-_=+~`|\\:;"'<>,.?/]/,
             "Password must include at least one special character"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function SignupApplicant() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  // Change this to your real API and success route
  const APPLICANT_HOME = "/applicant"; // or "/applicant/dashboard"
  const onSubmit = async (values) => {
    setSubmitError("");
    try {
      const res = await fetch("/auth/applicants/signup/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          full_name: values.fullName,
          email: values.email,
          national_id: values.nationalId,
          phone: values.phone,
          password: values.password,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "Signup failed");
        throw new Error(txt || "Signup failed");
      }
      // ✅ go to applicant home
      navigate(APPLICANT_HOME);
    } catch (e) {
      console.error(e);
      setSubmitError("Signup failed. Please try again.");
    }
  };

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        {/* Header */}
        <h1 className="auth-title">
          Get Started <span className="text-brand-600">Now.</span>
        </h1>
        <p className="auth-sub">
          Sign up <span className="text-gray-900">as Applicant</span>
        </p>

        {/* Form Card */}
        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting}>
          <div className="auth-grid">
            {/* LEFT column */}
            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="form-label">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Dominic Matthew"
                  aria-invalid={!!errors.fullName}
                  aria-describedby="fullName-error"
                  {...register("fullName")}
                />
                {errors.fullName && <p className="form-error" id="fullName-error">{errors.fullName.message}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="domat@example.com"
                  aria-invalid={!!errors.email}
                  aria-describedby="email-error"
                  {...register("email")}
                />
                {errors.email && <p className="form-error" id="email-error">{errors.email.message}</p>}
              </div>

              {/* National ID */}
              <div>
                <label htmlFor="nationalId" className="form-label">National ID</label>
                <input
                  id="nationalId"
                  type="text"
                  className="form-input"
                  placeholder="Set your National ID"
                  aria-invalid={!!errors.nationalId}
                  aria-describedby="nationalId-error"
                  {...register("nationalId")}
                />
                {errors.nationalId && <p className="form-error" id="nationalId-error">{errors.nationalId.message}</p>}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="form-label">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className="form-input"
                  placeholder="+9665XXXXXXXX"
                  aria-invalid={!!errors.phone}
                  aria-describedby="phone-error"
                  {...register("phone")}
                />
                {errors.phone && <p className="form-error" id="phone-error">{errors.phone.message}</p>}
              </div>
            </div>

            {/* RIGHT column */}
            <div className="space-y-4">
              {/* Password */}
              <div>
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Set your password"
                  aria-invalid={!!errors.password}
                  aria-describedby="password-error"
                  {...register("password")}
                />
                {errors.password && <p className="form-error" id="password-error">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="Confirm your password"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby="confirmPassword-error"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && (
                  <p className="form-error" id="confirmPassword-error">{errors.confirmPassword.message}</p>
                )}
              </div>

              
            </div>
            {/* Actions row */}
<div className="mt-6 col-span-2 md:col-span-2 flex flex-col items-end">
  <button
    type="submit"
    className="btn btn-primary min-w-32"
    disabled={isSubmitting}
  >
    {isSubmitting ? "Signing up…" : "Sign up"}
  </button>

  <span className="text-sm text-muted mt-2">
    Already have an account?{" "}
    <Link to="/login" className="font-medium text-brand-600">Sign in</Link>
  </span>
</div>



              {submitError && <p className="form-error">{submitError}</p>}
          </div>
        </form>
      </div>
    </section>
  );
}
