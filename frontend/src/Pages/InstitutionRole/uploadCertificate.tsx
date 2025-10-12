// src/Pages/InstitutionRole/UploadCertificate.tsx
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api } from "@/lib/api";

const MAX_FILE_MB = 5;
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);
const nationalIdRegex = /^\d{10}$/;

// NOTE: file is NOT part of the schema; we validate it manually.
const schema = z.object({
  nationalId: z.string().regex(nationalIdRegex, "Enter a valid National ID (10 digits)"),
  fullName: z.string().min(2, "Full name is required"),
  title: z.string().min(2, "Certificate title is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
});
type FormValues = z.infer<typeof schema>;

function UploadIllustration() {
  return (
    <div className="relative mb-3 h-20 w-20 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-brand-50" aria-hidden="true" />
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

export default function UploadCertificate() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
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
      setFile(null);
      setUploadName("");
      setFileError("Please upload a PDF");
      return;
    }
    const looksPdf = f.type === "application/pdf" || isPdfByName(f.name);
    if (!looksPdf) {
      setFile(null);
      setUploadName("");
      setFileError("Only PDF files are accepted");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setFile(null);
      setUploadName("");
      setFileError(`File must be ≤ ${MAX_FILE_MB}MB`);
      return;
    }
    setFile(f);
    setUploadName(f.name);
    setFileError("");
  };

  const clearFile = () => {
    setFile(null);
    setUploadName("");
    setFileError("");
    setServerError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const prevent = (e: React.DragEvent) => e.preventDefault();
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    pickFile(e.dataTransfer.files);
  };

  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2);

  const onSubmit = async (v: FormValues) => {
    setServerError("");

    if (!file) {
      setFileError("Please upload a PDF");
      return;
    }

    // Keys must match DRF: national_id, display_label, issued_on, serial_number, file
    const fd = new FormData();
    fd.append("national_id", v.nationalId);
    fd.append("display_label", v.title);
    fd.append("issued_on", v.issueDate);
    fd.append("serial_number", v.serialNumber);
    fd.append("file", file);

    try {
      const res = await api<any>("/certificates/issue/", { method: "POST", body: fd });

      clearFile();
      navigate(`/institution/upload/success/${encodeURIComponent(v.nationalId)}`, {
        state: {
          id: res?.id,
          txHash: res?.tx_hash,
          blockNumber: res?.block_number,
          cid: res?.cid_enc ?? res?.cid,
        },
      });
    } catch (err: any) {
      const msg =
        err?.userMessage ||
        err?.message ||
        err?.response?.data?.user_message ||
        "Upload failed.";
      setFileError("");       // prefer showing unified serverError
      setServerError(msg);
    }
  };

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Upload New{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Certificate
          </span>
        </h1>
        <p className="mt-2 text-gray-600">Certificate Details</p>

        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting} noValidate>
          <div className="auth-grid">
            {/* LEFT */}
            <div className="space-y-4">
              <div>
                <label htmlFor="nationalId" className="form-label">National ID</label>
                <input
                  id="nationalId"
                  type="text"
                  className="form-input"
                  placeholder="1233211234"
                  {...register("nationalId")}
                />
                {errors.nationalId && <p className="form-error">{errors.nationalId.message}</p>}
              </div>

              <div>
                <label htmlFor="fullName" className="form-label">Full Name</label>
                <input id="fullName" type="text" className="form-input" {...register("fullName")} />
                {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
              </div>

              <div>
                <label htmlFor="title" className="form-label">Certificate Title</label>
                <input id="title" type="text" className="form-input" {...register("title")} />
                {errors.title && <p className="form-error">{errors.title.message}</p>}
              </div>

              <div>
                <label htmlFor="issueDate" className="form-label">Issue Date</label>
                <input id="issueDate" type="date" className="form-input" {...register("issueDate")} />
                {errors.issueDate && <p className="form-error">{errors.issueDate.message}</p>}
              </div>

              <div>
                <label htmlFor="serialNumber" className="form-label">Serial Number</label>
                <input id="serialNumber" type="text" className="form-input" {...register("serialNumber")} />
                {errors.serialNumber && <p className="form-error">{errors.serialNumber.message}</p>}
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              <div>
                <label htmlFor="file" className="form-label block">Upload Certificate</label>

                <label
                  htmlFor="file"
                  className="upload-box group"
                  onDragEnter={prevent}
                  onDragOver={prevent}
                  onDragLeave={prevent}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadIllustration />
                  <div className="font-medium">Upload Certificate</div>
                  <div className="text-sm text-muted">Supported PDF format</div>
                </label>

                <input
                  id="file"
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display: "none" }}
                  onChange={(e) => pickFile(e.target.files)}
                />

                {uploadName && (
                  <div className="mt-3 text-sm">
                    <span className="badge badge-success">Selected</span> {uploadName}
                    <span className="ml-2 text-muted">{file ? ` (${mb(file.size)} MB)` : null}</span>
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
