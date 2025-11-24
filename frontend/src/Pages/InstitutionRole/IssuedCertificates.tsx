import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ethers } from "ethers";

/* ---------- Types ---------- */
type BackendCert = {
  id: string | number;
  display_label?: string;
  certificate_type?: string;
  issued_on?: string;
  applicant_full_name?: string;
  applicant_national_id_plain?: string | number;
  file_hash?: string;
  tx_hash?: string;
  block_number?: number | null;
};

type Row = {
  id: string;
  applicant: string;
  nationalId: string;
  title: string;
  type: string;
  issueDate: string;
  fileHash: string;
  status: "CHECKING" | "ACTIVE" | "REVOKED" | "INVALID";
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type StatusFilter = "" | "ACTIVE" | "REVOKED";

/* ---------- Helpers ---------- */
const normHash = (h: string) =>
  !h ? "" : (h.startsWith("0x") ? h : "0x" + h).toLowerCase();

const formatDate = (d?: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const REGISTRY_ABI = ["function revokeCertificate(string certificateHash) external"];

/* ---------- Components ---------- */
function StatusBadge({ status }: { status: Row["status"] }) {
  const config = {
    CHECKING: { bg: "bg-gray-100", text: "text-gray-600", label: "Checking..." },
    ACTIVE: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "✓", label: "Active" },
    REVOKED: { bg: "bg-red-100", text: "text-red-700", icon: "✕", label: "Revoked" },
    INVALID: { bg: "bg-amber-100", text: "text-amber-700", icon: "⚠", label: "Invalid" },
  };
  const { bg, text, icon, label } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${bg} ${text}`}>
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}

/* =======================================================
   Main Component
======================================================= */
export default function IssuedCertificates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  /* ---------- Fetch Certificates ---------- */
  const fetchCertificates = async (pageNum: number) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await api<Paginated<BackendCert>>(`/certificates/institution/?${params.toString()}`);

      const mapped: Row[] = res.results.map((d) => ({
        id: String(d.id),
        applicant: d.applicant_full_name || "—",
        nationalId: d.applicant_national_id_plain ? String(d.applicant_national_id_plain) : "—",
        title: d.display_label || "Untitled Certificate",
        type: d.certificate_type || "",
        issueDate: formatDate(d.issued_on),
        fileHash: d.file_hash || "",
        status: "CHECKING" as const,
      }));

      setRows(mapped);
      setTotal(res.count || mapped.length);
      setCanNext(Boolean(res.next));
      setCanPrev(Boolean(res.previous));
      setLoading(false);

      if (mapped.length > 0) verifyOnBlockchain(mapped);
    } catch (e: any) {
      setError(e?.userMessage || e?.message || "Failed to load certificates.");
      setLoading(false);
    }
  };

  /* ---------- Blockchain Verification ---------- */
  const verifyOnBlockchain = async (certs: Row[]) => {
    try {
      const fileHashes = Array.from(new Set(certs.map((c) => normHash(c.fileHash)).filter(Boolean)));
      if (fileHashes.length === 0) return;

      const resp = await api<any>("/certificates/institution/verify-batch/", {
        method: "POST",
        body: JSON.stringify({ file_hashes: fileHashes }),
      });

      const items = resp?.results || (Array.isArray(resp) ? resp : []);
      const lookup = new Map<string, { exists: boolean; revoked: boolean }>();

      items.forEach((it: any) => {
        const hash = it?.file_hash || it?.fileHash;
        if (hash) {
          lookup.set(normHash(hash), {
            exists: !!it.exists,
            revoked: !!(it.revoked || it.is_revoked),
          });
        }
      });

      setRows((prev) =>
        prev.map((r) => {
          const st = lookup.get(normHash(r.fileHash));
          if (!st || !st.exists) return { ...r, status: "INVALID" };
          if (st.revoked) return { ...r, status: "REVOKED" };
          return { ...r, status: "ACTIVE" };
        })
      );
    } catch (e) {
      console.error("Blockchain verification failed:", e);
    }
  };

  /* ---------- Revoke Certificate ---------- */
  const onRevoke = async (row: Row) => {
    try {
      setRevoking(true);

      if (!window.ethereum) {
        alert("MetaMask is not installed!");
        return;
      }

      const userData = await api<any>("/accounts/auth/me/");
      const contractAddress = userData?.profile?.contract_address;

      if (!contractAddress) {
        alert("Contract address not found!");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, REGISTRY_ABI, signer);

      const tx = await contract.revokeCertificate(row.fileHash);
      const receipt = await tx.wait();

      await api(`/certificates/institution/${encodeURIComponent(row.id)}/revoke/`, {
        method: "POST",
        body: JSON.stringify({ tx_hash: tx.hash, block_number: receipt.blockNumber }),
      });

      verifyOnBlockchain([row]);
      setConfirmOpen(false);
      setConfirmRow(null);
    } catch (error: any) {
      alert(error.reason || error.message || "Failed to revoke certificate");
    } finally {
      setRevoking(false);
    }
  };

  /* ---------- Effects ---------- */
  useEffect(() => {
    fetchCertificates(page);
  }, [page, searchQuery]);

  /* ---------- Filter locally ---------- */
  const filteredRows = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  // Counts
  const counts = {
    all: rows.length,
    active: rows.filter((r) => r.status === "ACTIVE").length,
    revoked: rows.filter((r) => r.status === "REVOKED").length,
  };

  /* ---------- Render ---------- */
  return (
    <section className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Issued{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Certificates
              </span>
            </h1>
            <p className="mt-1 text-gray-500">View and manage all certificates your institution has issued</p>
          </div>
          <Link
            to="/institution/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Issue Certificate
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by title, applicant, national ID..."
              value={searchQuery}
              onChange={(e) => { setPage(1); setSearchQuery(e.target.value); }}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === "" ? "bg-indigo-600 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === "" ? "bg-indigo-500" : "bg-gray-200"}`}>{counts.all}</span>
          </button>
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === "ACTIVE" ? "bg-emerald-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Active <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === "ACTIVE" ? "bg-emerald-400" : "bg-gray-200"}`}>{counts.active}</span>
          </button>
          <button
            onClick={() => setStatusFilter("REVOKED")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === "REVOKED" ? "bg-red-500 text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Revoked <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === "REVOKED" ? "bg-red-400" : "bg-gray-200"}`}>{counts.revoked}</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-32 bg-gray-100 rounded-xl"></div>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter ? `No ${statusFilter.toLowerCase()} certificates` : "No certificates issued yet"}
            </h3>
            <p className="text-gray-500 mb-6">
              {statusFilter ? "Try selecting a different filter" : "Start by issuing your first certificate"}
            </p>
            {!statusFilter && (
              <Link to="/institution/upload" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700">
                Issue Certificate
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Applicant</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Certificate</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Issued</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <span className="text-purple-600 font-semibold text-sm">
                              {row.applicant?.charAt(0)?.toUpperCase() || "?"}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{row.applicant}</p>
                            <p className="text-sm text-gray-500 font-mono">{row.nationalId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{row.title}</p>
                        {row.type && <p className="text-sm text-gray-500">{row.type}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{row.issueDate}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/institution/certificates/${row.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                          >
                            View
                          </Link>
                          {row.status === "ACTIVE" && (
                            <button
                              onClick={() => { setConfirmRow(row); setConfirmOpen(true); }}
                              disabled={revoking}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(canPrev || canNext) && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">Page {page} • {total} certificates</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => p - 1)} disabled={!canPrev} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    Previous
                  </button>
                  <button onClick={() => setPage((p) => p + 1)} disabled={!canNext} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Revoke Modal */}
        {confirmOpen && confirmRow && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmOpen(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Revoke Certificate</h2>
                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Certificate</span>
                    <p className="text-sm font-semibold text-gray-900">{confirmRow.title}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Applicant</span>
                    <p className="text-sm font-semibold text-gray-900">{confirmRow.applicant}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">National ID</span>
                    <p className="text-sm font-mono font-semibold text-gray-900">{confirmRow.nationalId}</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-amber-800">This will permanently mark the certificate as invalid on the blockchain.</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button onClick={() => setConfirmOpen(false)} className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                <button onClick={() => onRevoke(confirmRow)} disabled={revoking} className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {revoking ? "Revoking..." : "Revoke Certificate"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}