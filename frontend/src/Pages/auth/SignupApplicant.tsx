/**
 * Route: /signup/applicant
 * After success → /login
 */
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { api } from "@/lib/api";

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
      navigate("/login/", { replace: true });
    } catch (e: unknown) {
      const message = (e as any)?.message || "Signup failed. Please try again.";
      setSubmitError(message);
    }
  };

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Get Started{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Now
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Sign up as Applicant</p>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{submitError}</p>
            </div>
          </div>
        )}

        {/* Form Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} aria-busy={isSubmitting} noValidate>
            <div className="grid gap-6 p-6 md:grid-cols-2">
              {/* LEFT */}
              <div className="space-y-5">
                <div>
                  <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-gray-700">Full Name</label>
                  <input
                    id="fullName"
                    type="text"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Sara Sultan"
                    aria-invalid={!!errors.fullName}
                    {...register("fullName")}
                  />
                  {errors.fullName && <p className="mt-1.5 text-sm text-red-600">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="sara@example.com"
                    aria-invalid={!!errors.email}
                    {...register("email")}
                  />
                  {errors.email && <p className="mt-1.5 text-sm text-red-600">{errors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="nationalId" className="mb-2 block text-sm font-semibold text-gray-700">National ID</label>
                  <input
                    id="nationalId"
                    type="text"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="1234567890"
                    aria-invalid={!!errors.nationalId}
                    {...register("nationalId")}
                  />
                  {errors.nationalId && <p className="mt-1.5 text-sm text-red-600">{errors.nationalId.message}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-gray-700">Phone Number</label>
                  <input
                    id="phone"
                    type="tel"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="+9665XXXXXXXX"
                    aria-invalid={!!errors.phone}
                    {...register("phone")}
                  />
                  {errors.phone && <p className="mt-1.5 text-sm text-red-600">{errors.phone.message}</p>}
                </div>
              </div>

              {/* RIGHT */}
              <div className="space-y-5">
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold text-gray-700">Password</label>
                  <input
                    id="password"
                    type="password"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Set your password"
                    aria-invalid={!!errors.password}
                    {...register("password")}
                  />
                  {errors.password && <p className="mt-1.5 text-sm text-red-600">{errors.password.message}</p>}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-gray-700">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Confirm your password"
                    aria-invalid={!!errors.confirmPassword}
                    {...register("confirmPassword")}
                  />
                  {errors.confirmPassword && <p className="mt-1.5 text-sm text-red-600">{errors.confirmPassword.message}</p>}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">Sign in</Link>
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing up…
                  </>
                ) : (
                  "Sign Up"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}