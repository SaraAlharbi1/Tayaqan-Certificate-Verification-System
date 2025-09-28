import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/* -----------------------------------------------------------------------------
  Validation rules
  - Keep client rules in sync with backend serializers.
  - Only PDFs up to MAX_FILE_MB are allowed.
----------------------------------------------------------------------------- */
const MAX_FILE_MB = 5;
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);
const nationalIdRegex = /^\d{10}$/;

/** Zod schema for the form */
const schema = z.object({
  nationalId: z.string().regex(nationalIdRegex, "Enter a valid National ID (10 digits)"),
  fullName: z.string().min(2, "Full name is required"),
  title: z.string().min(2, "Certificate title is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  file: z
    .any()
    // must upload exactly one file
    .refine((v) => v instanceof FileList && v.length === 1, { message: "Please upload a PDF" })
    // must be PDF by MIME or filename (for some browsers)
    .refine((files) => {
      const f = (files as FileList).item(0);
      if (!f) return false;
      return f.type === "application/pdf" || isPdfByName(f.name);
    }, { message: "Only PDF files are accepted" })
    // size limit
    .refine((files) => {
      const f = (files as FileList).item(0);
      return !!f && f.size <= MAX_FILE_MB * 1024 * 1024;
    }, { message: `File must be ≤ ${MAX_FILE_MB}MB` }),
});

type FormValues = z.infer<typeof schema>;

/** Small illustration inside the upload box (purely visual/a11y-hidden) */
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
      <div className="absolute inset-0 rounded-full border-2 border-dotted border-border group-hover:border-brand-600 transition-colors" />
    </div>
  );
}

/* -----------------------------------------------------------------------------
  UploadCertificate
  - Two-column form: left = text fields, right = PDF uploader.
  - Drag & drop supported (label area).
  - Uses fetch() with multipart/form-data; credentials included for auth cookie.
  - On success: resets the form and shows a simple alert.
----------------------------------------------------------------------------- */
export default function UploadCertificate() {
  // Raw <input type="file"> ref so we can clear the native value
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state derived outside RHF for convenience (selected filename + custom error)
  const [uploadName, setUploadName] = useState("");
  const [fileError, setFileError] = useState("");

  // React Hook Form setup with Zod
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange", // validate as user types/selects
  });

  /** Clear the file selection both in RHF and the native input */
  const clearFile = () => {
    setUploadName("");
    setFileError("");
    // Create an empty FileList and set it into RHF
    const empty = new DataTransfer().files;
    setValue("file", empty, { shouldValidate: true });
    // Also clear the real input value
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Central handler to validate a selected file list and set into RHF */
  const onSelectFile = (files: FileList | null) => {
    if (!files || files.length === 0) {
      clearFile();
      return;
    }
    const f = files[0];

    // Type check: accept real pdf MIME or filename “.pdf” fallback
    const looksPdf = f.type === "application/pdf" || isPdfByName(f.name);
    if (!looksPdf) {
      setFileError("Only PDF files are accepted");
      clearFile();
      return;
    }

    // Size check
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFileError(`File must be ≤ ${MAX_FILE_MB}MB`);
      clearFile();
      return;
    }

    // Success: remember name, clear error, push to RHF
    setUploadName(f.name);
    setFileError("");
    setValue("file", files, { shouldValidate: true });
    clearErrors("file");
  };

  /** Drag-and-drop helpers (prevent browser opening the file) */
  const prevent = (e: React.DragEvent) => e.preventDefault();
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    onSelectFile(e.dataTransfer.files);
  };

  /** Pretty MB formatter for the selected file size display */
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2);

  /** Submit handler: builds FormData and POSTs to backend */
  const onSubmit = async (v: FormValues) => {
    const fd = new FormData();
    // Map frontend field names to backend parameter names
    fd.append("national_id", v.nationalId);
    fd.append("full_name", v.fullName);
    fd.append("title", v.title);
    fd.append("issue_date", v.issueDate);
    fd.append("serial_number", v.serialNumber);
    fd.append("file", v.file[0]); // first (and only) file

    try {
      // TODO: replace with your real API base (e.g., `${API}/institutions/certificates/`)
      const res = await fetch("/institutions/certificates/", {
        method: "POST",
        body: fd,
        credentials: "include", // send httpOnly refresh/auth cookies
      });

      if (!res.ok) throw new Error(await res.text().catch(() => "Upload failed"));

      // Minimal success UX (could be a toast in your design system)
      clearFile();
      setValue("nationalId", "" as any);
      setValue("fullName", "" as any);
      setValue("title", "" as any);
      setValue("issueDate", "" as any);
      setValue("serialNumber", "" as any);
      alert("Certificate uploaded successfully");
    } catch (e) {
      console.error(e);
      setFileError("Upload failed. Please try again.");
    }
  };

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        {/* Title & subtitle (consistent with your auth page style) */}
        <h1 className="auth-title">
          Upload New <span className="text-brand-600">Certificate</span>
        </h1>
        <p className="auth-sub">
          <span className="text-brand-600">Certificate</span> Details
        </p>

        {/* The form is rendered inside the white card container */}
        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting}>
          <div className="auth-grid">
            {/* ================= LEFT column: text inputs ================= */}
            <div className="space-y-4">
              {/* National ID */}
              <div>
                <label htmlFor="nationalId" className="form-label">National ID</label>
                <input
                  id="nationalId"
                  type="text"
                  className="form-input"
                  placeholder="123321123"
                  aria-invalid={!!errors.nationalId}
                  aria-describedby="nationalId-error"
                  {...register("nationalId")}
                />
                {errors.nationalId && <p className="form-error" id="nationalId-error">{errors.nationalId.message}</p>}
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="form-label">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  className="form-input"
                  placeholder="Lara Saad Alharbi"
                  aria-invalid={!!errors.fullName}
                  aria-describedby="fullName-error"
                  {...register("fullName")}
                />
                {errors.fullName && <p className="form-error" id="fullName-error">{errors.fullName.message}</p>}
              </div>

              {/* Certificate Title */}
              <div>
                <label htmlFor="title" className="form-label">Certificate Title</label>
                <input
                  id="title"
                  type="text"
                  className="form-input"
                  placeholder="e.g., STC"
                  aria-invalid={!!errors.title}
                  aria-describedby="title-error"
                  {...register("title")}
                />
                {errors.title && <p className="form-error" id="title-error">{errors.title.message}</p>}
              </div>

              {/* Issue Date */}
              <div>
                <label htmlFor="issueDate" className="form-label">Issue Date</label>
                <input
                  id="issueDate"
                  type="date"
                  className="form-input"
                  aria-invalid={!!errors.issueDate}
                  aria-describedby="issueDate-error"
                  {...register("issueDate")}
                />
                {errors.issueDate && <p className="form-error" id="issueDate-error">{errors.issueDate.message}</p>}
              </div>

              {/* Serial Number */}
              <div>
                <label htmlFor="serialNumber" className="form-label">Serial Number</label>
                <input
                  id="serialNumber"
                  type="text"
                  className="form-input"
                  placeholder="Enter serial number"
                  aria-invalid={!!errors.serialNumber}
                  aria-describedby="serialNumber-error"
                  {...register("serialNumber")}
                />
                {errors.serialNumber && <p className="form-error" id="serialNumber-error">{errors.serialNumber.message}</p>}
              </div>
            </div>

            {/* ================= RIGHT column: PDF upload ================= */}
            <div className="space-y-4">
              <div>
                <label htmlFor="file" className="form-label block">Upload Certificate</label>

                {/* Drop area (label tied to hidden file input) */}
                <label
                  htmlFor="file"
                  className="upload-box group"
                  onDragEnter={prevent}
                  onDragOver={prevent}
                  onDragLeave={prevent}
                  onDrop={onDrop}
                >
                  <UploadIllustration />
                  <div className="font-medium">Upload Certificate</div>
                  <div className="text-sm text-muted">Supported PDF format</div>
                </label>

                {/* Hidden native input; we manage selection via onChange */}
                <input
                  id="file"
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple={false}
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  {...register("file")}
                  // Allow selecting the same file twice by resetting value on click
                  onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
                  onChange={(e) => onSelectFile(e.target.files)}
                />

                {/* Selected file summary + remove button */}
                {uploadName && (
                  <div className="mt-3 text-sm">
                    <span className="badge badge-success">Selected</span> {uploadName}
                    <span className="ml-2 text-muted">
                      {getValues("file")?.[0] ? ` (${mb(getValues("file")[0].size)} MB)` : null}
                    </span>
                    <button type="button" className="btn btn-ghost btn-xs ml-3" onClick={clearFile}>
                      Remove
                    </button>
                  </div>
                )}

                {/* File-related errors (custom or from Zod) */}
                {(fileError || errors.file) && (
                  <p className="form-error" aria-live="polite">
                    {fileError || String(errors.file?.message)}
                  </p>
                )}
              </div>

              {/* Submit button (aligned right to match card actions style) */}
              <div className="form-actions justify-end">
                <button type="submit" className="btn btn-primary min-w-32" disabled={isSubmitting}>
                  {isSubmitting ? "Uploading…" : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
