// src/Pages/auth/SignupInstitution.tsx
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const API = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

// --- file checks ---
const MAX_FILE_MB = 5;
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);

// --- schema (no file in Zod; file handled in state) ---
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
      <svg className="relative h-10 w-10 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

    // final file gate
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
    fd.append("role", "INSTITUTION"); // optional

    const res = await fetch(`${API}/auth/signup/institution`, {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      let msg = "";
      try {
        const data = await res.json();
        msg = typeof data === "string" ? data : JSON.stringify(data);
      } catch {
        msg = await res.text().catch(() => "");
      }
      setServerError(msg || `Signup failed (${res.status})`);
      return;
    }

    navigate("/signup/success/institution", { replace: true });
  };

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        <h1 className="auth-title">
          Get Started <span className="text-brand-600">Now.</span>
        </h1>
        <p className="auth-sub">
          Sign up <span className="text-gray-900">as Institution</span>
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting}>
          <div className="auth-grid">
            {/* LEFT */}
            <div className="space-y-4">
              <div>
                <label htmlFor="institutionName" className="form-label">Institution Name</label>
                <input
                  id="institutionName"
                  className="form-input"
                  placeholder="e.g., King Abdulaziz University"
                  aria-invalid={!!errors.institutionName}
                  {...register("institutionName")}
                />
                {errors.institutionName && <p className="form-error">{errors.institutionName.message}</p>}
              </div>

              <div>
                <label htmlFor="officialEmail" className="form-label">Official Email</label>
                <input
                  id="officialEmail"
                  type="email"
                  className="form-input"
                  placeholder="deanoffice@example.com"
                  aria-invalid={!!errors.officialEmail}
                  {...register("officialEmail")}
                />
                {errors.officialEmail && <p className="form-error">{errors.officialEmail.message}</p>}
              </div>

              <div>
                <label htmlFor="department" className="form-label">Department / Registrar Office</label>
                <input
                  id="department"
                  className="form-input"
                  placeholder="Registrar, Admissions, …"
                  aria-invalid={!!errors.department}
                  {...register("department")}
                />
                {errors.department && <p className="form-error">{errors.department.message}</p>}
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

              <div>
                <label htmlFor="proof_doc" className="form-label block">Proof of Authorization</label>

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
                    <span className="badge badge-success">Selected</span> {uploadName}
                    <span className="ml-2 text-muted">
                      {poaFile ? ` (${mb(poaFile.size)} MB)` : null}
                    </span>
                    <button type="button" className="btn btn-ghost btn-xs ml-3" onClick={clearFile}>
                      Remove
                    </button>
                  </div>
                )}

                {(fileError || serverError) && (
                  <p className="form-error" aria-live="polite">
                    {fileError || serverError}
                  </p>
                )}
              </div>
            </div>

            {/* Actions row — same layout as Applicant/Employer */}
            <div className="mt-6 col-span-2 md:col-span-2 flex flex-col items-end">
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
