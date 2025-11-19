import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

// Validation patterns
const phoneRegex = /^(\+?\d{8,15})$/;

// Zod Schema (matches backend)
const schema = z
  .object({
    full_name: z.string().min(2, "Full name is required"),
    official_email: z.string().email("Enter a valid email"),
    company_name: z.string().min(2, "Company name is required"),
    phone: z.string().regex(phoneRegex, "Enter a valid phone number"),
    password: z
      .string()
      .min(8, "Min 8 chars")
      .regex(/[A-Za-z]/, "Must include a letter")
      .regex(/\d/, "Must include a number"),
    confirm_password: z.string().min(8, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

export default function SignupEmployer() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [proofDoc, setProofDoc] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  // File Upload
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];

    if (!f) {
      setProofDoc(null);
      setFileError("Please upload a PDF file");
      return;
    }

    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
      setProofDoc(null);
      setFileError("Only PDF files are accepted");
      return;
    }

    if (f.size > 5 * 1024 * 1024) {
      setProofDoc(null);
      setFileError("File must be ≤ 5MB");
      return;
    }

    setProofDoc(f);
    setFileError("");
  }

const onSubmit = async (v: FormValues) => {
  if (!proofDoc) {
    setFileError("Please upload a PDF proof document");
    return;
  }

  const fd = new FormData();
  Object.entries(v).forEach(([k, val]) => fd.append(k, val));
  fd.append("proof_doc", proofDoc);

  try {
    await api("/accounts/signup/employer/", {
      method: "POST",
      body: fd,
    });

    navigate("/login", { replace: true });
  } catch (err: any) {
    console.log(err);
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
          <p className="mt-1 text-sm text-gray-500">Sign up as Employer (HR)</p>
        </div>

        {/* Error Banner */}
        {(submitError || fileError) && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              {submitError || fileError}
            </p>
          </div>
        )}

        {/* Card */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            
            <div className="grid gap-4 p-5 md:grid-cols-2">

              {/* Full Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Full Name
                </label>
                <input
                  {...register("full_name")}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Your full name"
                />
                {errors.full_name && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.full_name.message}
                  </p>
                )}
              </div>

              {/* Official Email */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Work Email
                </label>
                <input
                  {...register("official_email")}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="name@company.com"
                />
                {errors.official_email && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.official_email.message}
                  </p>
                )}
              </div>

              {/* Company Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Company Name
                </label>
                <input
                  {...register("company_name")}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Company"
                />
                {errors.company_name && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.company_name.message}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Phone Number
                </label>
                <input
                  {...register("phone")}
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="+9665XXXXXXX"
                />
                {errors.phone && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Password
                </label>
                <input
                  {...register("password")}
                  type="password"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                />
                {errors.password && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Confirm Password
                </label>
                <input
                  {...register("confirm_password")}
                  type="password"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                />
                {errors.confirm_password && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.confirm_password.message}
                  </p>
                )}
              </div>

              {/* PDF Upload */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Proof of Authorization (PDF)
                </label>

                <div
                  onClick={() => fileRef.current?.click()}
                  className="border border-gray-300 rounded-lg p-3 bg-gray-50 text-sm cursor-pointer hover:bg-gray-100"
                >
                  Click to upload PDF
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFile}
                />

                {proofDoc && (
                  <p className="text-xs mt-2 text-gray-600">
                    Selected: {proofDoc.name}
                  </p>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="text-indigo-600 font-medium">
                  Sign in
                </Link>
              </span>

              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg
                hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </section>
  );
}
