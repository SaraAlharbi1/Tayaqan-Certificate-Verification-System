// src/Pages/InstitutionRole/UploadCertificate.tsx
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/** --- Validation --- */
const MAX_FILE_MB = 5;
const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);
const nationalIdRegex = /^\d{10}$/;

const schema = z.object({
  nationalId: z.string().regex(nationalIdRegex, "Enter a valid National ID (10 digits)"),
  fullName: z.string().min(2, "Full name is required"),
  title: z.string().min(2, "Certificate title is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  serialNumber: z.string().min(1, "Serial number is required"),
  file: z
    .any()
    .refine((v) => v instanceof FileList && v.length === 1, { message: "Please upload a PDF" })
    .refine((files) => {
      const f = (files as FileList).item(0);
      return f && (f.type === "application/pdf" || isPdfByName(f.name));
    }, { message: "Only PDF files are accepted" })
    .refine((files) => {
      const f = (files as FileList).item(0);
      return f && f.size <= MAX_FILE_MB * 1024 * 1024;
    }, { message: `File must be ≤ ${MAX_FILE_MB}MB` }),
});

type FormValues = z.infer<typeof schema>;

function UploadIllustration() {
  return (
    <div className="relative mb-3 h-20 w-20 flex items-center justify-center">
      <div className="absolute inset-0 rounded-full bg-brand-50" aria-hidden="true" />
      <svg className="relative h-10 w-10 text-brand-600 transition-colors" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 16h10a4 4 0 0 0 .5-7.965A6 6 0 0 0 6 9a4 4 0 0 0 1 7z" />
        <path d="M12 13V8" />
        <path d="M9.5 10.5 12 8l2.5 2.5" />
      </svg>
      <div className="absolute inset-0 rounded-full border-2 border-dotted border-border group-hover:border-brand-600 transition-colors" />
    </div>
  );
}

export default function UploadCertificate() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadName, setUploadName] = useState("");
  const [fileError, setFileError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const clearFile = () => {
    setUploadName("");
    setFileError("");
    const empty = new DataTransfer().files;
    setValue("file", empty, { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSelectFile = (files: FileList | null) => {
    if (!files?.length) return clearFile();
    const f = files[0];
    if (!(f.type === "application/pdf" || isPdfByName(f.name)))
      return setFileError("Only PDF files are accepted"), clearFile();
    if (f.size > MAX_FILE_MB * 1024 * 1024)
      return setFileError(`File must be ≤ ${MAX_FILE_MB}MB`), clearFile();
    setUploadName(f.name);
    setFileError("");
    setValue("file", files, { shouldValidate: true });
    clearErrors("file");
  };

  const prevent = (e: React.DragEvent) => e.preventDefault();
  const onDrop: React.DragEventHandler<HTMLLabelElement> = (e) => {
    e.preventDefault();
    onSelectFile(e.dataTransfer.files);
  };

  const mb = (n: number) => (n / (1024 * 1024)).toFixed(2);

  const onSubmit = async (v: FormValues) => {
    const fd = new FormData();
    fd.append("national_id", v.nationalId);
    fd.append("full_name", v.fullName);
    fd.append("title", v.title);
    fd.append("issue_date", v.issueDate);
    fd.append("serial_number", v.serialNumber);
    fd.append("file", v.file[0]);

    try {
      const res = await fetch("/institutions/certificates/", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text().catch(() => "Upload failed"));

      clearFile();
      setValue("nationalId", "" as any);
      setValue("fullName", "" as any);
      setValue("title", "" as any);
      setValue("issueDate", "" as any);
      setValue("serialNumber", "" as any);

      navigate("/institution/upload/success/" + v.nationalId);
    } catch (e) {
      console.error(e);
      setFileError("Upload failed. Please try again.");
    }
  };

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        <h1 className="auth-title">
          Upload New <span className="text-brand-600">Certificate</span>
        </h1>
        <p className="auth-sub">
          <span className="text-brand-600">Certificate</span> Details
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="auth-card" aria-busy={isSubmitting}>
          <div className="auth-grid">
            <div className="space-y-4">
              <label className="form-label">National ID
                <input id="nationalId" type="text" className="form-input" placeholder="123321123"
                  {...register("nationalId")} />
                {errors.nationalId && <p className="form-error">{errors.nationalId.message}</p>}
              </label>

              <label className="form-label">Full Name
                <input id="fullName" type="text" className="form-input" placeholder="Lara Saad Alharbi"
                  {...register("fullName")} />
                {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
              </label>

              <label className="form-label">Certificate Title
                <input id="title" type="text" className="form-input" placeholder="e.g., STC"
                  {...register("title")} />
                {errors.title && <p className="form-error">{errors.title.message}</p>}
              </label>

              <label className="form-label">Issue Date
                <input id="issueDate" type="date" className="form-input" {...register("issueDate")} />
                {errors.issueDate && <p className="form-error">{errors.issueDate.message}</p>}
              </label>

              <label className="form-label">Serial Number
                <input id="serialNumber" type="text" className="form-input" placeholder="Enter serial number"
                  {...register("serialNumber")} />
                {errors.serialNumber && <p className="form-error">{errors.serialNumber.message}</p>}
              </label>
            </div>

            <div className="space-y-4">
              <label htmlFor="file" className="form-label block">Upload Certificate</label>
              <label htmlFor="file" className="upload-box group"
                onDragEnter={prevent} onDragOver={prevent} onDragLeave={prevent} onDrop={onDrop}>
                <UploadIllustration />
                <div className="font-medium">Upload Certificate</div>
                <div className="text-sm text-muted">Supported PDF format</div>
              </label>

              <input id="file" type="file" accept=".pdf,application/pdf" multiple={false}
                ref={fileInputRef} style={{ display: "none" }} {...register("file")}
                onClick={(e) => { (e.currentTarget as HTMLInputElement).value = ""; }}
                onChange={(e) => onSelectFile(e.target.files)} />

              {uploadName && (
                <div className="mt-3 text-sm">
                  <span className="badge badge-success">Selected</span> {uploadName}
                  {getValues("file")?.[0] &&
                    <span className="ml-2 text-muted"> ({mb(getValues("file")[0].size)} MB)</span>}
                  <button type="button" className="btn btn-ghost btn-xs ml-3" onClick={clearFile}>Remove</button>
                </div>
              )}

              {(fileError || errors.file) && (
                <p className="form-error">{fileError || String(errors.file?.message)}</p>
              )}

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

