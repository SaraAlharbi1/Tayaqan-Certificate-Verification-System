import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";

const phoneRegex = /^(\+?\d{8,15})$/;
const nationalIdRegex = /^\d{10}$/;

const schema = z
  .object({
    full_name: z.string().min(2, "Full name is required"),
    email: z.string().email("Enter a valid email"),
    national_id: z
      .string()
      .regex(nationalIdRegex, "Enter a valid National ID (10 digits)"),
    phone: z
      .string()
      .regex(phoneRegex, "Enter a valid phone number (8–15 digits)"),
    wallet_address: z
      .string()
      .startsWith("0x", "Wallet address must start with 0x")
      .length(42, "Wallet address must be 42 characters"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must include at least one letter")
      .regex(/\d/, "Password must include at least one number")
      .regex(
        /[!@#$%^&*()[\]{}\-_=+~`|\\:;"'<>,.?/]/,
        "Password must include a special character"
      ),
    confirm_password: z.string().min(8, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

export default function SignupApplicant() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitError("");

    try {
      // ✅ FIX: use api(...) not api.post(...)
      await api("/accounts/signup/applicant/", {
        method: "POST",
        body: JSON.stringify(values),
      });

      navigate("/login", { replace: true });
    } catch {
      setSubmitError("Signup failed. Please try again.");
    }
  };

  return (
    <section className="py-6">
      <div className="auth-wrap max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Get Started{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Now
            </span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">Sign up as Applicant</p>
        </div>

        {submitError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        {/* Form Card */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4 p-5 md:grid-cols-2">

              {/* Full Name */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm 
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Sara Sultan"
                  {...register("full_name")}
                />
                {errors.full_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.full_name.message}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="sara@example.com"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* National ID */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  National ID
                </label>
                <input
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="1234567890"
                  {...register("national_id")}
                />
                {errors.national_id && (
                  <p className="text-xs text-red-600 mt-1">{errors.national_id.message}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="+9665XXXXXXXX"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-xs text-red-600 mt-1">{errors.phone.message}</p>
                )}
              </div>

              {/* Wallet Address */}
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Ethereum Wallet Address
                </label>
                <input
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="0xABC123..."
                  {...register("wallet_address")}
                />
                {errors.wallet_address && (
                  <p className="text-xs text-red-600 mt-1">{errors.wallet_address.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                  {...register("confirm_password")}
                />
                {errors.confirm_password && (
                  <p className="text-xs text-red-600 mt-1">{errors.confirm_password.message}</p>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
                  Sign in
                </Link>
              </span>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 
                rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Signing up…" : "Sign Up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
