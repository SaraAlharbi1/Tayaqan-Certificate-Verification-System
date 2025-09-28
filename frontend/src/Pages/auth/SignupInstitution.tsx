/**
 * SignupInstitution.tsx
 *
 * Institution sign-up form with:
 * - react-hook-form + zod validation
 * - PDF upload (Proof of Authorization) with drag & drop
 * - Strong typing (TypeScript)
 * - Accessible labels, aria props, keyboard handling
 *
 * Route: /signup/institution
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
// helper to also allow PDFs where browser leaves MIME type empty
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);

const phoneRegex = /^(\+?\d{8,15})$/; // Accepts + and 8-15 digits (optional +)

// Zod schema defines the shape & constraints of the form data
const schema = z
  .object({
    institutionName: z.string().min(2, "Institution name is required"),
    officialEmail: z.string().email("Enter a valid email"),
    department: z.string().min(2, "Department / Registrar Office is required"),
    phone: z.string().regex(phoneRegex, "Enter a valid phone number (8-15 digits, optional +)"),

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

    // FileList validator: robust check for single valid PDF ≤ MAX_FILE_MB
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
  // Cross-field refinement: password === confirmPassword
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// TypeScript type generated from the Zod schema
type FormValues = z.infer<typeof schema>;

// ---------------------------
// Small upload icon illustration (cloud + arrow inside circle)
// ---------------------------
function UploadIllustration() {
  return (
    <div className="relative mb-3 h-20 w-20 flex items-center justify-center">
      {/* Soft circle background */}
      <div className="absolute inset-0 rounded-full bg-brand-50" aria-hidden="true" />

      {/* Cloud with centered arrow */}
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
        {/* Cloud */}
        <path d="M7 16h10a4 4 0 0 0 .5-7.965A6 6 0 0 0 6 9a4 4 0 0 0 1 7z" />
        {/* Arrow up */}
        <path d="M12 13V8" />
        <path d="M9.5 10.5 12 8l2.5 2.5" />
      </svg>

      {/* Dotted border ring that changes color on hover only (uses parent .group) */}
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
export default function SignupInstitution() {
  const navigate = useNavigate();

  // UI state just for the upload box
  const [uploadName, setUploadName] = useState<string>("");
  const [fileError, setFileError] = useState<string>("");

  // We hide the file input and trigger it programmatically (ref still useful even with label approach)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // React Hook Form: wires inputs to validation with zod
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    trigger,
    getValues,
    clearErrors, // ⬅ used to clear error when file is valid
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange", // validate while typing
    reValidateMode: "onChange",
  });

  // Helper: clear the selected file (creates an empty FileList)
  const clearFile = () => {
    setUploadName("");
    setFileError("");
    const emptyFiles = new DataTransfer().files; // empty FileList
    setValue("proof", emptyFiles, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Single source of truth for file selection (from click or drop)
  const onSelectFile = (files: FileList | null) => {
    if (!files || files.length === 0) {
      clearFile();
      return;
    }
    const file = files[0];

    // Light client-side checks
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

    // All good — update UI and RHF value
    setUploadName(file.name);
    setFileError("");
    setValue("proof", files, { shouldValidate: true });
    clearErrors("proof"); // ⬅ clear error immediately
  };

  // DnD helpers — keep the browser from navigating to the file
  const prevent = (e: React.DragEvent) => e.preventDefault();
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    onSelectFile(e.dataTransfer.files);
  };

  // Submit handler — switch the fake call to your real API endpoint
  const onSubmit = async (values: FormValues) => {
    const fd = new FormData();
    fd.append("institution_name", values.institutionName);
    fd.append("official_email", values.officialEmail);
    fd.append("department", values.department);
    fd.append("phone", values.phone);
    fd.append("password", values.password);
    fd.append("proof", values.proof[0]); // actual file blob

    try {
      const res = await fetch("/auth/institutions/signup/", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "Signup failed"));
      // navigate to pending approval page
      navigate("/signup/success/institution");
    } catch (err) {
      console.error(err);
      setFileError("Signup failed. Please try again.");
    }
  };

  // Pretty-print MB size for the selected file
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2);

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        {/* Header */}
        <h1 className="auth-title">
          Get Started <span className="text-brand-600">Now.</span>
        </h1>
        <p className="auth-sub">
          Sign up <span className="text-gray-900">as Institution</span>
        </p>

        {/* Form Card */}
        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting}>
          <div className="auth-grid">
            {/* LEFT column */}
            <div className="space-y-4">
              {/* Institution Name */}
              <div>
                <label htmlFor="institutionName" className="form-label">Institution Name</label>
                <input
                  id="institutionName"
                  type="text"
                  className="form-input"
                  placeholder="e.g., King Abdulaziz University"
                  aria-invalid={!!errors.institutionName}
                  aria-describedby="institutionName-error"
                  {...register("institutionName")}
                />
                {errors.institutionName && (
                  <p className="form-error" id="institutionName-error">
                    {errors.institutionName.message}
                  </p>
                )}
              </div>

              {/* Official Email */}
              <div>
                <label htmlFor="officialEmail" className="form-label">Official Email</label>
                <input
                  id="officialEmail"
                  type="email"
                  className="form-input"
                  placeholder="deanoffice@example.com"
                  aria-invalid={!!errors.officialEmail}
                  aria-describedby="officialEmail-error"
                  {...register("officialEmail")}
                />
                {errors.officialEmail && (
                  <p className="form-error" id="officialEmail-error">
                    {errors.officialEmail.message}
                  </p>
                )}
              </div>

              {/* Department */}
              <div>
                <label htmlFor="department" className="form-label">Department / Registrar Office</label>
                <input
                  id="department"
                  type="text"
                  className="form-input"
                  placeholder="Registrar, Admissions, …"
                  aria-invalid={!!errors.department}
                  aria-describedby="department-error"
                  {...register("department")}
                />
                {errors.department && (
                  <p className="form-error" id="department-error">
                    {errors.department.message}
                  </p>
                )}
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
                {errors.phone && (
                  <p className="form-error" id="phone-error">
                    {errors.phone.message}
                  </p>
                )}
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
                {errors.password && (
                  <p className="form-error" id="password-error">
                    {errors.password.message}
                  </p>
                )}
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
                  <p className="form-error" id="confirmPassword-error">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Upload Proof */}
              <div>
                <label htmlFor="proof" className="form-label block">Proof of Authorization</label>

                {/* Upload box is now the label for the hidden input */}
                <label
                  htmlFor="proof"
                  className="upload-box group"
                  onDragEnter={prevent}
                  onDragOver={prevent}
                  onDragLeave={prevent}
                  onDrop={onDrop} // DnD
                >
                  {/* Upload icon illustration (cloud + arrow) */}
                  <UploadIllustration />

                  <div className="font-medium">Upload Proof of Authorization</div>
                  <div className="text-sm text-muted">Supported PDF format</div>
                </label>

                {/* Hidden file input; registered so RHF tracks validation */}
                <input
                  id="proof"
                  type="file"
                  accept="application/pdf"
                  multiple={false} // only allow one file
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  {...register("proof")}
                  onClick={(e) => {
                    // allow picking the same file again by resetting the value
                    (e.currentTarget as HTMLInputElement).value = "";
                  }}
                  onChange={(e) => onSelectFile(e.target.files)}
                />

                {/* Selected file summary + remove */}
                {uploadName && (
                  <div className="mt-3 text-sm">
                    <span className="badge badge-success">Selected</span> {uploadName}
                    <span className="ml-2 text-muted">
                      {getValues("proof")?.[0] ? ` (${mb(getValues("proof")[0].size)} MB)` : null}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs ml-3"
                      onClick={clearFile}
                    >
                      Remove
                    </button>
                  </div>
                )}

                {/* Validation / file errors */}
                {(fileError || errors.proof) && (
                  <p className="form-error" aria-live="polite">
                    {fileError || String(errors.proof?.message)}
                  </p>
                )}
              </div>

              {/* Actions row */}
              <div className="form-actions">
                <span className="text-sm text-muted">
                  Already have an account? <Link to="/login" className="font-medium">Sign in</Link>
                </span>
                <button type="submit" className="btn btn-primary min-w-32" disabled={isSubmitting}>
                  {isSubmitting ? "Signing up…" : "Sign up"}
                </button>
              </div>
            </div> {/* end RIGHT column */}
          </div> {/* end auth-grid */}
        </form> {/* end form */}
      </div> {/* end auth-wrap */}
    </section> /* end section */
  );
}
