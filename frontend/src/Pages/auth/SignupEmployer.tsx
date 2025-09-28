/**
 * SignupEmployer.tsx
 *
 * HR / Employer sign-up form with:
 * - react-hook-form + zod validation
 * - PDF upload (Proof of Authorization) with drag & drop
 * - Strong typing (TypeScript)
 * - Accessible labels, aria props, keyboard handling
 *
 * Route: /signup/employer
 */

import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// ---------------------------
// Constants & Validation
// ---------------------------
const MAX_FILE_MB = 5;
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);

const phoneRegex = /^(\+?\d{8,15})$/; // + optional, 8–15 digits
const crRegex = /^\d{5,15}$/; // Company Identifier (CR): 5–15 digits (adjust to your rule)

// Zod schema defines the shape & constraints of the form data
const schema = z
  .object({
    fullName: z.string().min(2, "Full name is required"),
    workEmail: z.string().email("Enter a valid work email"),
    companyName: z.string().min(2, "Company name is required"),
    crNumber: z.string().regex(crRegex, "Enter a valid CR number (digits only)"),
    phone: z.string().regex(phoneRegex, "Enter a valid phone number (8–15 digits, optional +)"),

    // Strong password policy
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must include at least one letter")
      .regex(/\d/, "Password must include at least one number")
      .regex(
        /[!@#$%^&*()[\]{}\-_=+~`|\\:;"'<>,.?/]/,
        "Password must include at least one special character"
      ),

    confirmPassword: z.string().min(8, "Please confirm your password"),

    // Single valid PDF ≤ MAX_FILE_MB
    proof: z
      .any()
      .refine((v) => v instanceof FileList && v.length === 1, {
        message: "Please upload a PDF letter",
      })
      .refine((files) => {
        const f = (files as FileList).item(0);
        if (!f) return false;
        return f.type === "application/pdf" || isPdfByName(f.name);
      }, { message: "Only PDF files are accepted" })
      .refine((files) => {
        const f = (files as FileList).item(0);
        return !!f && f.size <= MAX_FILE_MB * 1024 * 1024;
      }, { message: `File must be ≤ ${MAX_FILE_MB}MB` }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

// ---------------------------
// Small upload icon illustration (cloud + arrow inside circle)
// ---------------------------
function UploadIllustration() {
  return (
    <div className="relative mb-3 h-20 w-20 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-brand-50" aria-hidden="true" />
      <svg
        className="relative h-10 w-10 text-brand-600 transition-colors"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 16h10a4 4 0 0 0 .5-7.965A6 6 0 0 0 6 9a4 4 0 0 0 1 7z" />
        <path d="M12 13V8" />
        <path d="M9.5 10.5 12 8l2.5 2.5" />
      </svg>
      <div
        className="absolute inset-0 rounded-full border-2 border-dotted border-border 
                   group-hover:border-brand-600 transition-colors"
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------
// Component
// ---------------------------
export default function SignupEmployer() {
  const navigate = useNavigate();

  const [uploadName, setUploadName] = useState<string>("");
  const [fileError, setFileError] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    getValues,
    clearErrors,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const clearFile = () => {
    setUploadName("");
    setFileError("");
    const emptyFiles = new DataTransfer().files;
    setValue("proof", emptyFiles, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSelectFile = (files: FileList | null) => {
    if (!files || files.length === 0) {
      clearFile();
      return;
    }
    const file = files[0];
    const looksPdf = file.type === "application/pdf" || isPdfByName(file.name);
    if (!looksPdf) {
      setFileError("Only PDF files are accepted");
      clearFile();
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File must be ≤ ${MAX_FILE_MB}MB`);
      clearFile();
      return;
    }
    setUploadName(file.name);
    setFileError("");
    setValue("proof", files, { shouldValidate: true });
    clearErrors("proof");
  };

  const prevent = (e: React.DragEvent) => e.preventDefault();
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    onSelectFile(e.dataTransfer.files);
  };

  // Submit handler — switch the URL to your real API
  const onSubmit = async (values: FormValues) => {
    const fd = new FormData();
    fd.append("full_name", values.fullName);
    fd.append("work_email", values.workEmail);
    fd.append("company_name", values.companyName);
    fd.append("cr_number", values.crNumber);
    fd.append("phone", values.phone);
    fd.append("password", values.password);
    fd.append("proof", values.proof[0]);

    try {
      // Prefer using an env base URL in dev/prod
      // const API = import.meta.env.VITE_API_URL;
      // const res = await fetch(`${API}/auth/employers/signup/`, { ... });
      const res = await fetch("/auth/employers/signup/", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "Signup failed"));
      navigate("/signup/success/hr"); // role = "hr" to match SuccessPending labels
    } catch (err) {
      console.error(err);
      setFileError("Signup failed. Please try again.");
    }
  };

  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2);

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        {/* Header */}
        <h1 className="auth-title">
          Get Started <span className="text-brand-600">Now.</span>
        </h1>
        <p className="auth-sub">
          Sign up <span className="text-gray-900">as HR employer</span>
        </p>

        {/* Form Card */}
        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting}>
          <div className="auth-grid">
            {/* LEFT column */}
            <div className="space-y-4">
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

              <div>
                <label htmlFor="workEmail" className="form-label">Work Email</label>
                <input
                  id="workEmail"
                  type="email"
                  className="form-input"
                  placeholder="name@company.com"
                  aria-invalid={!!errors.workEmail}
                  aria-describedby="workEmail-error"
                  {...register("workEmail")}
                />
                {errors.workEmail && <p className="form-error" id="workEmail-error">{errors.workEmail.message}</p>}
              </div>

              <div>
                <label htmlFor="companyName" className="form-label">Company Name</label>
                <input
                  id="companyName"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Acme Corp"
                  aria-invalid={!!errors.companyName}
                  aria-describedby="companyName-error"
                  {...register("companyName")}
                />
                {errors.companyName && <p className="form-error" id="companyName-error">{errors.companyName.message}</p>}
              </div>

              <div>
                <label htmlFor="crNumber" className="form-label">Company Identifier (CR Number)</label>
                <input
                  id="crNumber"
                  type="text"
                  className="form-input"
                  placeholder="e.g., 1010XXXXXX"
                  aria-invalid={!!errors.crNumber}
                  aria-describedby="crNumber-error"
                  {...register("crNumber")}
                />
                {errors.crNumber && <p className="form-error" id="crNumber-error">{errors.crNumber.message}</p>}
              </div>

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

              <div>
                <label htmlFor="proof" className="form-label block">Proof of Authorization</label>

                {/* Upload box acts as label for the hidden input */}
                <label
                  htmlFor="proof"
                  className="upload-box group"
                  onDragEnter={prevent}
                  onDragOver={prevent}
                  onDragLeave={prevent}
                  onDrop={onDrop}
                >
                  <UploadIllustration />
                  <div className="font-medium">Upload Proof of Authorization</div>
                  <div className="text-sm text-muted">Supported PDF format</div>
                </label>

                {/* Hidden file input */}
                <input
                  id="proof"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple={false}
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  {...register("proof")}
                  onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
                  onChange={(e) => onSelectFile(e.target.files)}
                />

                {/* Selected file summary + remove */}
                {uploadName && (
                  <div className="mt-3 text-sm">
                    <span className="badge badge-success">Selected</span> {uploadName}
                    <span className="ml-2 text-muted">
                      {getValues("proof")?.[0] ? ` (${mb(getValues("proof")[0].size)} MB)` : null}
                    </span>
                    <button type="button" className="btn btn-ghost btn-xs ml-3" onClick={clearFile}>
                      Remove
                    </button>
                  </div>
                )}

                {(fileError || errors.proof) && (
                  <p className="form-error" aria-live="polite">
                    {fileError || String(errors.proof?.message)}
                  </p>
                )}
              </div>

              <div className="form-actions">
                <span className="text-sm text-muted">
                  Already have an account? <Link to="/login" className="font-medium">Sign in</Link>
                </span>
                <button type="submit" className="btn btn-primary min-w-32" disabled={isSubmitting}>
                  {isSubmitting ? "Signing up…" : "Sign up"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
