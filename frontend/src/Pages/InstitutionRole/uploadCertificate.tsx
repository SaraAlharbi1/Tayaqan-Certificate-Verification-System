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

// file is NOT in schema; validated manually
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
      <svg className="relative h-10 w-10 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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
  } = useForm<FormValues>({ resolver: zodResolver(schema), mode: "onChange" });

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
      setFileError(`File must be â‰¤ ${MAX_FILE_MB}MB`);
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

    // must match DRF field names
    const fd = new FormData();
    fd.append("national_id", v.nationalId); 
    fd.append("display_label", v.title);
    fd.append("issued_on", v.issueDate);
    fd.append("serial_number", v.serialNumber);
    fd.append("file", file);

    try {
      const res = await api<any>("/institution/certificates/issue/", { method: "POST", body: fd });

      clearFile();
      navigate(`/institution/upload/success/${encodeURIComponent(v.nationalId)}`, {
        state: {
          id: res?.id,
          txHash: res?.tx_hash,
          blockNumber: res?.block_number,
          cid: res?.cid_blob ?? res?.cid,
        },
      });
    } catch (err: any) {
      const msg =
        err?.userMessage ||
        err?.message ||
        err?.response?.data?.user_message ||
        "Upload failed.";
      setFileError("");
      setServerError(msg);
    }
  };

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Upload New{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificate
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Fill in the certificate details and upload the PDF document</p>
        </div>

        {serverError && (
          <div className="mb-6 rounded-xl border-2 border-red-2 00 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">Upload Failed</p>
                <p className="mt-1 text-sm text-red-700">{serverError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} aria-busy={isSubmitting} noValidate>
            <div className="grid gap-6 p-6 md:grid-cols-2">
              {/* LEFT */}
              <div className="space-y-5">
                <div>
                  <label htmlFor="nationalId" className="mb-2 block text-sm font-semibold text-gray-700">National ID</label>
                  <input id="nationalId" type="text" className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4" placeholder="1233211234" {...register("nationalId")} />
                  {errors.nationalId && <p className="mt-1.5 text-sm text-red-600">{errors.nationalId.message}</p>}
                </div>

                <div>
                  <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-gray-700">Full Name</label>
                  <input id="fullName" type="text" className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4" placeholder="Enter full name" {...register("fullName")} />
                  {errors.fullName && <p className="mt-1.5 text-sm text-red-600">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label htmlFor="title" className="mb-2 block text-sm font-semibold text-gray-700">Certificate Title</label>
                  <input id="title" type="text" className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4" placeholder="e.g., Bachelor of Science" {...register("title")} />
                  {errors.title && <p className="mt-1.5 text-sm text-red-600">{errors.title.message}</p>}
                </div>

                <div>
                  <label htmlFor="issueDate" className="mb-2 block text-sm font-semibold text-gray-700">Issue Date</label>
                  <input id="issueDate" type="date" className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4" {...register("issueDate")} />
                  {errors.issueDate && <p className="mt-1.5 text-sm text-red-600">{errors.issueDate.message}</p>}
                </div>

                <div>
                  <label htmlFor="serialNumber" className="mb-2 block text-sm font-semibold text-gray-700">Serial Number</label>
                  <input id="serialNumber" type="text" className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4" placeholder="Enter serial number" {...register("serialNumber")} />
                  {errors.serialNumber && <p className="mt-1.5 text-sm text-red-600">{errors.serialNumber.message}</p>}
                </div>
              </div>

              {/* RIGHT - File */}
              <div className="space-y-5">
                <div>
                  <label htmlFor="file" className="mb-2 block text-sm font-semibold text-gray-700">Upload Certificate</label>

                  <label
                    htmlFor="file"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-12 transition-all hover:border-indigo-400 hover:bg-indigo-50/50"
                    onDragEnter={prevent}
                    onDragOver={prevent}
                    onDragLeave={prevent}
                    onDrop={onDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadIllustration />
                    <div className="mt-2 text-center">
                      <div className="font-semibold text-gray-700">Upload Certificate</div>
                      <div className="mt-1 text-sm text-gray-500">Drag & drop or click to browse</div>
                      <div className="mt-1 text-xs text-gray-400">PDF format only (max {MAX_FILE_MB}MB)</div>
                    </div>
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
                    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <svg className="h-5 w-5 flex-shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-emerald-900 truncate">{uploadName}</p>
                            {file && <p className="text-xs text-emerald-700">{mb(file.size)} MB</p>}
                          </div>
                        </div>
                        <button type="button" className="ml-3 flex-shrink-0 text-sm font-medium text-red-600 hover:text-red-700" onClick={clearFile}>
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex items-center justify-end gap-3">
                <button type="button" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50" onClick={() => navigate("/institution")} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploadingâ€¦
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload Certificate
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

