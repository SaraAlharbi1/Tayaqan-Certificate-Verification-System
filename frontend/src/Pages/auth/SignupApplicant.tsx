/**
 * Route: /signup/applicant
 * After success → /login
 */
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { api } from "@/lib/api"; // ✅ central API helper (TS)

const phoneRegex = /^(\+?\d{8,15})$/;
const nationalIdRegex = /^\d{10}$/;

const schema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  nationalId: z.string().regex(nationalIdRegex, "Enter a valid National ID (10 digits)"),
  phone: z.string().regex(phoneRegex, "Enter a valid phone number (8–15 digits, optional +)"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/\d/, "Password must include at least one number")
    .regex(/[!@#$%^&*()[\]{}\-_=+~`|\\:;"'<>,.?/]/, "Password must include at least one special character"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type FormValues = z.infer<typeof schema>;

export default function SignupApplicant() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState("");

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" });

  const onSubmit = async (values: FormValues) => {
    setSubmitError("");
    try {
      await api("/auth/signup/applicant/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: values.fullName,
          email: values.email,
          national_id: values.nationalId,
          phone: values.phone,
          password: values.password,
          confirm_password: values.confirmPassword,
        }),
      });
      navigate("/login/", { replace: true }); // ✅ go to login
    } catch (e: unknown) {
      const message = (e as any)?.message || "Signup failed. Please try again.";
      setSubmitError(message);
    }
  };

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        {/* Header (gradient, no underline) */}
         <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
            Get Started{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Now.
            </span>
          </h1>
        <p className="auth-sub">Sign up <span className="text-gray-900">as Applicant</span></p>

        {/* Form Card */}
        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting} noValidate>
          <div className="auth-grid">
            {/* LEFT */}
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="form-label">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Sara Sultan"
                  aria-invalid={!!errors.fullName}
                  {...register("fullName")}
                />
                {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
              </div>

              <div>
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="sara@example.com"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
                {errors.email && <p className="form-error">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="nationalId" className="form-label">National ID</label>
                <input
                  id="nationalId"
                  type="text"
                  className="form-input"
                  placeholder="Set your National ID"
                  aria-invalid={!!errors.nationalId}
                  {...register("nationalId")}
                />
                {errors.nationalId && <p className="form-error">{errors.nationalId.message}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="form-label">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className="form-input"
                  placeholder="+9665XXXXXXXX"
                  aria-invalid={!!errors.phone}
                  {...register("phone")}
                />
                {errors.phone && <p className="form-error">{errors.phone.message}</p>}
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Set your password"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                {errors.password && <p className="form-error">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-input"
                  placeholder="Confirm your password"
                  aria-invalid={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword && <p className="form-error">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 col-span-2 flex flex-col items-end">
              {submitError && <p className="form-error w-full">{submitError}</p>}
              <button type="submit" className="btn btn-primary min-w-32" disabled={isSubmitting}>
                {isSubmitting ? "Signing up…" : "Sign up"}
              </button>
              <span className="text-sm text-muted mt-2">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-brand-600">Sign in</Link>
              </span>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
