// --------------------------------------------
// Imports
// --------------------------------------------
import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { getWalletAddress, getContractAddress } from "@/lib/auth";
import { ethers } from "ethers";

// --------------------------------------------
// Constants & Helpers
// --------------------------------------------
const MAX_FILE_MB = 5;
const nationalIdRegex = /^\d{10}$/;

const isPdfByName = (name?: string) => !!name && /\.pdf$/i.test(name);

const truncateAddress = (addr: string) => {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// zod schema
const schema = z.object({
  national_id: z.string().regex(nationalIdRegex, "Enter a valid National ID"),
  full_name: z.string().min(2, "Full name is required"),
  title: z.string().min(2, "Certificate title is required"),
  certificate_type: z.string().min(2, "Certificate type is required"),
  issued_on: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ABI
const CERTIFICATE_REGISTRY_ABI = [
  "function issueCertificate(string fileHash, bytes32 applicantIdHash, string certificateType, uint256 issuedOn) external returns (uint256)",
];

// --------------------------------------------
// Main Component
// --------------------------------------------
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Load contract address if missing
  useEffect(() => {
    if (savedContractAddress) {
      setContractAddress(savedContractAddress);
      return;
    }

    (async () => {
      try {
        const res = await api<any>("/accounts/auth/me/");
        const addr = res?.profile?.contract_address || null;
        setContractAddress(addr);
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
        const provider = new ethers.BrowserProvider(window.ethereum);
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
    if (window.ethereum)
      window.ethereum.on("accountsChanged", () => checkWallet());
  }, [institutionWallet]);

  // --------------------------------------------
  // File Handling
  // --------------------------------------------
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

  // --------------------------------------------
  // Submit Form
  // --------------------------------------------
  const onSubmit = async (v: FormValues) => {
    setServerError("");
    setIsProcessing(true);

    try {
      if (!file) {
        setFileError("Please upload a PDF");
        return;
      }

      if (!connectedWallet) {
        setServerError("Connect MetaMask wallet.");
        return;
      }

      if (!institutionWallet) {
        setServerError("Institution wallet missing.");
        return;
      }

      if (connectedWallet.toLowerCase() !== institutionWallet.toLowerCase()) {
        setServerError("Wallet does not match institution wallet.");
        return;
      }

      if (!contractAddress) {
        setServerError("Institution contract not deployed.");
        return;
      }

      // STEP 1 — PREPARE BACKEND
      const fd = new FormData();
      fd.append("national_id", v.national_id);
      fd.append("full_name", v.full_name);
      fd.append("title", v.title);
      fd.append("certificate_type", v.certificate_type);
      if (v.issued_on) fd.append("issued_on", v.issued_on);
      fd.append("pdf_file", file);

      const prepare = await api<any>("/certificates/institution/prepare/", {
        method: "POST",
        body: fd,
      });

      const { file_hash, applicant_id_hash, cid } = prepare.blockchain_data;

      // STEP 2 — BLOCKCHAIN
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CERTIFICATE_REGISTRY_ABI, signer);

      const issuedOnTimestamp = v.issued_on
        ? Math.floor(new Date(v.issued_on).getTime() / 1000)
        : Math.floor(Date.now() / 1000);

      const tx = await contract.issueCertificate(
        file_hash,
        applicant_id_hash,
        v.certificate_type,
        issuedOnTimestamp
      );

      const receipt = await tx.wait();

      // STEP 3 — CONFIRM BACKEND (capture response with real certificate_id)
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
            cid,
            file_hash,
            applicant_id_hash,
            contract_address: contractAddress,
            tx_hash: tx.hash,
            block_number: receipt.blockNumber,
          }),
        }
      );

      // Use real DB certificate_id from backend
      navigate("/institution/success", {
        state: {
          certificate_id: confirmResponse.certificate_id,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
        },
      });
    } catch (err: any) {
      console.error(err);
      setServerError(err?.userMessage || err?.message || "Failed to issue certificate.");
    } finally {
      setIsProcessing(false);
    }
  };

  const disableUpload =
    isSubmitting ||
    isProcessing ||
    walletMismatch ||
    !connectedWallet ||
    !institutionWallet ||
    !contractAddress;

  // --------------------------------------------
  // RENDER
  // --------------------------------------------
  return (
    <div className="min-h-screen bg-white py-3 px-3 md:py-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Upload New{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificate
            </span>
          </h1>

          <p className="mt-1 text-gray-500 text-sm md:text-base">
            Fill in the certificate details and upload the PDF document.
          </p>
        </div>

        {/* Wallet Status Card */}
        <div className="mb-3 bg-white rounded-lg shadow-sm border border-gray-200 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Wallet Status</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[11px] text-gray-600 mb-0.5">Expected Wallet</p>
              <p className="text-xs font-mono font-semibold text-gray-900">
                {institutionWallet ? truncateAddress(institutionWallet) : "Not configured"}
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[11px] text-gray-600 mb-0.5">Connected Wallet</p>
              <p
                className={`text-xs font-mono font-semibold ${
                  walletMismatch
                    ? "text-red-600"
                    : connectedWallet
                    ? "text-green-600"
                    : "text-gray-400"
                }`}
              >
                {connectedWallet ? truncateAddress(connectedWallet) : "Not connected"}
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {serverError && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
            {serverError}
          </div>
        )}

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="p-4 md:p-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* National ID */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      National ID
                    </label>
                    <input
                      {...register("national_id")}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        errors.national_id ? "border-red-300 bg-red-50" : "border-gray-300"
                      }`}
                      placeholder="1234567890"
                    />
                    {errors.national_id && (
                      <p className="mt-1 text-xs text-red-600">{errors.national_id.message}</p>
                    )}
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      {...register("full_name")}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        errors.full_name ? "border-red-300 bg-red-50" : "border-gray-300"
                      }`}
                      placeholder="Enter full name"
                    />
                    {errors.full_name && (
                      <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
                    )}
                  </div>

                  {/* Certificate Title */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Certificate Title
                    </label>
                    <input
                      {...register("title")}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        errors.title ? "border-red-300 bg-red-50" : "border-gray-300"
                      }`}
                      placeholder="e.g., Bachelor of Computer Science"
                    />
                    {errors.title && (
                      <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
                    )}
                  </div>

                  {/* Certificate Type */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Certificate Type
                    </label>
                    <select
                      {...register("certificate_type")}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${
                        errors.certificate_type
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select certificate type</option>
                      <option value="Bachelor Degree">Bachelor Degree</option>
                      <option value="Master Degree">Master Degree</option>
                      <option value="Doctorate Degree">Doctorate Degree</option>
                      <option value="Diploma">Diploma</option>
                      <option value="Professional Certificate">Professional Certificate</option>
                    </select>
                    {errors.certificate_type && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.certificate_type.message}
                      </p>
                    )}
                  </div>

                  {/* Issue Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Issue Date
                    </label>
                    <input
                      type="date"
                      {...register("issued_on")}
                      className="w-full px-3 py-2 rounded-lg text-sm border border-gray-300"
                    />
                  </div>
                </div>

                {/* Right Column (File Upload) */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Upload Certificate (PDF)
                  </label>

                  {!uploadName ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="relative min-h-[180px] flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-all"
                    >
                      <div className="text-center p-4">
                        <div className="w-12 h-12 mx-auto mb-2 bg-indigo-100 rounded-full flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-indigo-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                        </div>
                        <p className="text-xs font-medium text-gray-700">
                          Click to upload or drag & drop
                        </p>
                        <p className="text-[11px] text-gray-500">
                          PDF files only · Max {MAX_FILE_MB}MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-3 bg-green-50 border-green-200">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {uploadName}
                      </p>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="mt-2 text-xs text-red-600 font-medium"
                      >
                        Remove file
                      </button>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,application/pdf"
                    onChange={(e) => pickFile(e.target.files)}
                  />

                  {fileError && (
                    <p className="mt-2 text-xs text-red-600">{fileError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate("/institution")}
                disabled={isSubmitting || isProcessing}
                className="px-4 py-2 text-xs text-gray-700 font-medium hover:bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={disableUpload}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-xs text-white font-semibold rounded-lg shadow disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isProcessing ? "Processing..." : "Upload & Issue Certificate"}
              </button>
            </div>
          </form>
        </div>

        {/* Helper Text */}
        {disableUpload && !isProcessing && (
          <div className="mt-2 text-center">
            <p className="text-[11px] text-gray-500">
              {!connectedWallet
                ? "⚠ Connect MetaMask to continue"
                : walletMismatch
                ? "⚠ Connected wallet must match institution wallet"
                : !contractAddress
                ? "⚠ Contract not deployed"
                : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
