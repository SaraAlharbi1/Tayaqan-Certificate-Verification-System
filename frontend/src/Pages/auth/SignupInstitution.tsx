// src/Pages/auth/SignupInstitution.tsx
/**
 * Route: /signup/institution
 * After success → /signup/success/:role  (role = "institution")
 */
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";

// --- file checks ---
const MAX_FILE_MB = 5;
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);

// --- schema (file handled outside Zod) ---
const phoneRegex = /^(\+?\d{8,15})$/;
const schema = z
  .object({
    institutionName: z.string().min(2, "Institution name is required"),
    officialEmail: z.string().email("Enter a valid email"),
    department: z.string().min(2, "Department / Registrar Office is required"),
    phone: z.string().regex(phoneRegex, "Enter a valid phone number (8–15 digits, optional +)"),
    password: z
      .string()
      .min(8, "Min 8 chars")
      .regex(/[A-Za-z]/, "Include a letter")
      .regex(/\d/, "Include a number")
      .regex(/[!@#$%^&*()[\]{}\-_=+~`|\\:;\"'<>,.?/]/, "Include a special char"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

function UploadIllustration() {
  return (
    <div className="relative mb-3 h-20 w-20 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-brand-50" />
      <svg
        className="relative h-10 w-10 text-brand-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M7 16h10a4 4 0 0 0 .5-7.965A6 6 0 0 0 6 9a4 4 0 0 0 1 7z" />
        <path d="M12 13V8" />
        <path d="M9.5 10.5 12 8l2.5 2.5" />
      </svg>
      <div className="absolute inset-0 rounded-full border-2 border-dotted border-border" />
    </div>
  );
}

export default function SignupInstitution() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // file state (outside RHF)
  const [poaFile, setPoaFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const pickFile = (files: FileList | null) => {
    const f = files?.[0] || null;
    setServerError("");
    if (!f) {
      setPoaFile(null);
      setUploadName("");
      setFileError("Please upload a PDF letter");
      return;
    }
    const looksPdf = f.type === "application/pdf" || isPdfByName(f.name);
    if (!looksPdf) {
      setPoaFile(null);
      setUploadName("");
      setFileError("Only PDF files are accepted");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setPoaFile(null);
      setUploadName("");
      setFileError(`File must be ≤ ${MAX_FILE_MB}MB`);
      return;
    }
    setPoaFile(f);
    setUploadName(f.name);
    setFileError("");
  };

  const prevent = (e: React.DragEvent) => e.preventDefault();
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    pickFile(e.dataTransfer.files);
  };

  const clearFile = () => {
    setPoaFile(null);
    setUploadName("");
    setFileError("");
    setServerError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2);

  const onSubmit = async (v: FormValues) => {
    setServerError("");

    // final file validation
    if (!poaFile) {
      setFileError("Please upload a PDF letter");
      return;
    }
    const looksPdf = poaFile.type === "application/pdf" || isPdfByName(poaFile.name);
    if (!looksPdf) {
      setFileError("Only PDF files are accepted");
      return;
    }
    if (poaFile.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File must be ≤ ${MAX_FILE_MB}MB`);
      return;
    }

    const fd = new FormData();
    fd.append("institution_name", v.institutionName);
    fd.append("official_email", v.officialEmail);
    fd.append("department", v.department);
    fd.append("phone", v.phone);
    fd.append("password", v.password);
    fd.append("confirm_password", v.confirmPassword);
    fd.append("proof_doc", poaFile);

    try {
      await api("/auth/signup/institution/", { method: "POST", body: fd });
      navigate("/signup/success/institution", { replace: true });
    } catch (e: unknown) {
      const message = (e as any)?.message || "Signup failed.";
      setServerError(message);
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
          <p className="mt-1 text-gray-500">Sign up as Institution</p>
        </div>

        {/* Error Banner */}
        {(fileError || serverError) && (
          <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{fileError || serverError}</p>
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
                  <label htmlFor="institutionName" className="mb-2 block text-sm font-semibold text-gray-700">Institution Name</label>
                  <input
                    id="institutionName"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., King Abdulaziz University"
                    aria-invalid={!!errors.institutionName}
                    {...register("institutionName")}
                  />
                  {errors.institutionName && <p className="mt-1.5 text-sm text-red-600">{errors.institutionName.message}</p>}
                </div>

                <div>
                  <label htmlFor="officialEmail" className="mb-2 block text-sm font-semibold text-gray-700">Official Email</label>
                  <input
                    id="officialEmail"
                    type="email"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="deanoffice@example.com"
                    aria-invalid={!!errors.officialEmail}
                    {...register("officialEmail")}
                  />
                  {errors.officialEmail && <p className="mt-1.5 text-sm text-red-600">{errors.officialEmail.message}</p>}
                </div>

                <div>
                  <label htmlFor="department" className="mb-2 block text-sm font-semibold text-gray-700">Department / Registrar Office</label>
                  <input
                    id="department"
                    className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-900 outline-none ring-0 transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    placeholder="Registrar, Admissions, …"
                    aria-invalid={!!errors.department}
                    {...register("department")}
                  />
                  {errors.department && <p className="mt-1.5 text-sm text-red-600">{errors.department.message}</p>}
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

                <div>
                  <label htmlFor="proof_doc" className="mb-2 block text-sm font-semibold text-gray-700">Proof of Authorization</label>

                  <label
                    htmlFor="proof_doc"
                    className="upload-box group"
                    onDragEnter={prevent}
                    onDragOver={prevent}
                    onDragLeave={prevent}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIllustration />
                    <div className="font-medium">Upload Proof of Authorization</div>
                    <div className="text-sm text-muted">Supported PDF format</div>
                  </label>

                  <input
                    id="proof_doc"
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    style={{ display: "none" }}
                    onChange={(e) => pickFile(e.target.files)}
                  />

                  {uploadName && (
                    <div className="mt-3 text-sm">
                      <span className="badge badge-success">Selected</span>{" "}
                      {uploadName}
                      <span className="ml-2 text-muted">
                        {poaFile ? ` (${mb(poaFile.size)} MB)` : null}
                      </span>
                      <button type="button" className="btn btn-ghost btn-xs ml-3" onClick={clearFile}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
                  Sign in
                </Link>
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