import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";

const MAX_FILE_MB = 5;
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);

// Validation rules
const phoneRegex = /^(\+?\d{8,15})$/;
const walletRegex = /^0x[a-fA-F0-9]{40}$/;

// Zod schema
const schema = z
  .object({
    institution_name: z.string().min(2, "Institution name is required"),
    official_email: z.string().email("Enter a valid email"),
    phone: z.string().regex(phoneRegex, "Enter a valid phone number"),
    wallet_address: z
      .string()
      .regex(walletRegex, "Wallet address must start with 0x and be 42 characters"),
    password: z
      .string()
      .min(8, "Min 8 characters")
      .regex(/[A-Za-z]/, "Must include a letter")
      .regex(/\d/, "Must include a number")
      .regex(/[!@#$%^&*()[\]{}\-_=+~`|\\:;"'<>,.?/]/, "Must include a special character"),
    confirm_password: z.string().min(8, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

export default function SignupInstitution() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [poaFile, setPoaFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
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

  function pickFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) {
      setPoaFile(null);
      setUploadName("");
      setFileError("Please upload a PDF letter");
      return;
    }

    const isPdf = f.type === "application/pdf" || isPdfByName(f.name);
    if (!isPdf) {
      setFileError("Only PDF files are accepted");
      return;
    }

    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File must be ≤ ${MAX_FILE_MB}MB`);
      return;
    }

    setPoaFile(f);
    setUploadName(f.name);
    setFileError("");
  }

  function prevent(e: React.DragEvent) {
    e.preventDefault();
  }

  const onSubmit = async (values: FormValues) => {
    if (!poaFile) {
      setFileError("Please upload a PDF file");
      return;
    }

    const fd = new FormData();
    Object.entries(values).forEach(([k, val]) => fd.append(k, val));
    fd.append("proof_doc", poaFile);

    try {
      // ✅ FIXED: use api(...) not api.post(...)
      await api("/accounts/signup/institution/", {
        method: "POST",
        body: fd,
      });

      navigate("/login", { replace: true });
    } catch (e: any) {
      setSubmitError(e.userMessage || "Signup failed.");
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
          <p className="mt-1 text-sm text-gray-500">Sign up as Institution</p>
        </div>

        {(submitError || fileError) && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{submitError || fileError}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4 p-5 md:grid-cols-2">
              {/* Institution Name */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Institution Name
                </label>
                <input
                  {...register("institution_name")}
                  placeholder="University / College Name"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm 
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.institution_name && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.institution_name.message}
                  </p>
                )}
              </div>

              {/* Official Email */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Official Email
                </label>
                <input
                  {...register("official_email")}
                  type="email"
                  placeholder="office@example.com"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm 
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.official_email && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.official_email.message}
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
                  placeholder="+9665XXXXXXXX"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm 
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.phone && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              {/* Wallet Address */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Ethereum Wallet Address
                </label>
                <input
                  {...register("wallet_address")}
                  placeholder="0xABC123…"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm 
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
                {errors.wallet_address && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.wallet_address.message}
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
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                  placeholder="••••••••"
                  className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm
                  focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={prevent}
                  onDrop={(e) => {
                    prevent(e);
                    pickFile(e.dataTransfer.files);
                  }}
                  className="border border-gray-300 rounded-lg p-3 bg-gray-50 text-sm cursor-pointer 
                  hover:bg-gray-100 transition"
                >
                  Click or drag-and-drop to upload PDF
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files)}
                />

                {uploadName && (
                  <p className="text-xs mt-2 text-gray-600">
                    Selected: {uploadName}
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-indigo-600 hover:text-indigo-700"
                >
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
