// frontend/src/Pages/InstitutionRole/UploadCertificate.tsx
import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { getWalletAddress, getContractAddress } from "@/lib/auth";
import { ethers } from "ethers";

/* ---------- Constants ---------- */
const MAX_FILE_MB = 5;

const schema = z.object({
  national_id: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit National ID"),
  full_name: z.string().min(2, "Full name is required"),
  title: z.string().min(2, "Certificate title is required"),
  certificate_type: z.string().min(2, "Certificate type is required"),
  issued_on: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const CERTIFICATE_REGISTRY_ABI = [
  "function issueCertificate(string fileHash, bytes32 applicantIdHash, string certificateType, uint256 issuedOn) external returns (uint256)",
];

const truncateAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

/* ---------- Main Component ---------- */
export default function UploadCertificate() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const institutionWallet = getWalletAddress();
  const savedContractAddress = getContractAddress();

  const [contractAddress, setContractAddress] = useState<string | null>(savedContractAddress);
  const [file, setFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [walletMismatch, setWalletMismatch] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Load contract address
  useEffect(() => {
    if (savedContractAddress) {
      setContractAddress(savedContractAddress);
      return;
    }
    (async () => {
      try {
        const res = await api<any>("/accounts/auth/me/");
        setContractAddress(res?.profile?.contract_address || null);
      } catch {
        setContractAddress(null);
      }
    })();
  }, [savedContractAddress]);

  // Auto-connect MetaMask
  useEffect(() => {
    async function checkWallet() {
      if (!window.ethereum) return;
      try {
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        const acc = accounts?.[0] || null;
        setConnectedWallet(acc);
        if (acc && institutionWallet) {
          setWalletMismatch(acc.toLowerCase() !== institutionWallet.toLowerCase());
        }
      } catch (err) {
        console.log("MetaMask connection error:", err);
      }
    }
    checkWallet();
    if (window.ethereum) window.ethereum.on("accountsChanged", () => checkWallet());
  }, [institutionWallet]);

  // File handling
  const pickFile = (files: FileList | null) => {
    const f = files?.[0] || null;
    setServerError("");

    if (!f) {
      setFile(null);
      setUploadName("");
      setFileError("Please upload a PDF");
      return;
    }

    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    if (!isPdf) {
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit
  const onSubmit = async (v: FormValues) => {
    setServerError("");
    setIsProcessing(true);

    try {
      if (!file) { setFileError("Please upload a PDF"); return; }
      if (!connectedWallet) { setServerError("Connect MetaMask wallet."); return; }
      if (!institutionWallet) { setServerError("Institution wallet missing."); return; }
      if (connectedWallet.toLowerCase() !== institutionWallet.toLowerCase()) {
        setServerError("Wallet does not match institution wallet.");
        return;
      }
      if (!contractAddress) { setServerError("Institution contract not deployed."); return; }

      // Step 1: Prepare
      const fd = new FormData();
      fd.append("national_id", v.national_id);
      fd.append("full_name", v.full_name);
      fd.append("title", v.title);
      fd.append("certificate_type", v.certificate_type);
      if (v.issued_on) fd.append("issued_on", v.issued_on);
      fd.append("pdf_file", file);

      const prepare = await api<any>("/certificates/institution/prepare/", { method: "POST", body: fd });
      const { file_hash, applicant_id_hash, cid } = prepare.blockchain_data;

      // Step 2: Blockchain
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CERTIFICATE_REGISTRY_ABI, signer);

      const issuedOnTimestamp = v.issued_on ? Math.floor(new Date(v.issued_on).getTime() / 1000) : Math.floor(Date.now() / 1000);
      const tx = await contract.issueCertificate(file_hash, applicant_id_hash, v.certificate_type, issuedOnTimestamp);
      const receipt = await tx.wait();

      // Step 3: Confirm
      const confirmResponse = await api<{ success: boolean; certificate_id: number }>(
        "/certificates/institution/confirm/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            national_id: v.national_id,
            title: v.title,
            certificate_type: v.certificate_type,
            issued_on: v.issued_on || null,
            cid, file_hash, applicant_id_hash,
            contract_address: contractAddress,
            tx_hash: tx.hash,
            block_number: receipt.blockNumber,
          }),
        }
      );

      navigate("/institution/success", {
        state: { certificate_id: confirmResponse.certificate_id, txHash: tx.hash, blockNumber: receipt.blockNumber },
      });
    } catch (err: any) {
      setServerError(err?.userMessage || err?.message || "Failed to issue certificate.");
    } finally {
      setIsProcessing(false);
    }
  };

  const disableUpload = isSubmitting || isProcessing || walletMismatch || !connectedWallet || !institutionWallet || !contractAddress;

  return (
    <section className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Issue{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Certificate
              </span>
            </h1>
            <p className="mt-1 text-gray-500">Fill in the details and upload the PDF document</p>
          </div>
          <Link to="/institution/certificates" className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        {/* Wallet Status */}
        <div className="mb-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Wallet Status</h3>
              <p className="text-sm text-gray-500">Connect your institution wallet to issue certificates</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Expected Wallet</p>
              <p className="font-mono text-sm font-semibold text-gray-900">
                {institutionWallet ? truncateAddress(institutionWallet) : "Not configured"}
              </p>
            </div>
            <div className={`rounded-xl p-4 ${connectedWallet ? (walletMismatch ? 'bg-red-50' : 'bg-emerald-50') : 'bg-gray-50'}`}>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Connected Wallet</p>
              <p className={`font-mono text-sm font-semibold ${walletMismatch ? 'text-red-600' : connectedWallet ? 'text-emerald-600' : 'text-gray-400'}`}>
                {connectedWallet ? truncateAddress(connectedWallet) : "Not connected"}
              </p>
              {walletMismatch && <p className="text-xs text-red-600 mt-1">⚠ Wallet mismatch</p>}
              {connectedWallet && !walletMismatch && <p className="text-xs text-emerald-600 mt-1">✓ Connected</p>}
            </div>
          </div>
        </div>

        {/* Error */}
        {serverError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Form Fields */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">National ID</label>
                    <input
                      {...register("national_id")}
                      placeholder="1234567890"
                      className={`w-full h-12 px-4 rounded-xl border-2 ${errors.national_id ? 'border-red-300 bg-red-50' : 'border-gray-200'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-mono`}
                    />
                    {errors.national_id && <p className="mt-2 text-sm text-red-600">{errors.national_id.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
                    <input
                      {...register("full_name")}
                      placeholder="Enter applicant's full name"
                      className={`w-full h-12 px-4 rounded-xl border-2 ${errors.full_name ? 'border-red-300 bg-red-50' : 'border-gray-200'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all`}
                    />
                    {errors.full_name && <p className="mt-2 text-sm text-red-600">{errors.full_name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Certificate Title</label>
                    <input
                      {...register("title")}
                      placeholder="e.g., Bachelor of Computer Science"
                      className={`w-full h-12 px-4 rounded-xl border-2 ${errors.title ? 'border-red-300 bg-red-50' : 'border-gray-200'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all`}
                    />
                    {errors.title && <p className="mt-2 text-sm text-red-600">{errors.title.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Certificate Type</label>
                    <select
                      {...register("certificate_type")}
                      className={`w-full h-12 px-4 rounded-xl border-2 ${errors.certificate_type ? 'border-red-300 bg-red-50' : 'border-gray-200'} focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all`}
                    >
                      <option value="">Select type</option>
                      <option value="Bachelor Degree">Bachelor Degree</option>
                      <option value="Master Degree">Master Degree</option>
                      <option value="Doctorate Degree">Doctorate Degree</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Professional Certificate">Professional Certificate</option>
                    </select>
                    {errors.certificate_type && <p className="mt-2 text-sm text-red-600">{errors.certificate_type.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Issue Date</label>
                    <input
                      type="date"
                      {...register("issued_on")}
                      className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Right Column - File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Certificate PDF</label>

                  {!uploadName ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
                    >
                      <div className="w-16 h-16 mb-4 bg-indigo-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-700">Click to upload or drag & drop</p>
                      <p className="text-xs text-gray-500 mt-1">PDF files only • Max {MAX_FILE_MB}MB</p>
                    </div>
                  ) : (
                    <div className="min-h-[300px] flex flex-col items-center justify-center border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-6">
                      <div className="w-16 h-16 mb-4 bg-emerald-100 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 text-center break-all">{uploadName}</p>
                      <button type="button" onClick={clearFile} className="mt-4 px-4 py-2 text-sm text-red-600 font-medium hover:bg-red-100 rounded-lg">
                        Remove file
                      </button>
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,application/pdf" onChange={(e) => pickFile(e.target.files)} />
                  {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex items-center justify-between">
              <button type="button" onClick={() => navigate("/institution")} disabled={isProcessing} className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg disabled:opacity-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={disableUpload}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Issue Certificate
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Helper */}
        {disableUpload && !isProcessing && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              {!connectedWallet ? "⚠ Connect MetaMask to continue" : walletMismatch ? "⚠ Connected wallet must match institution wallet" : !contractAddress ? "⚠ Contract not deployed" : ""}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}