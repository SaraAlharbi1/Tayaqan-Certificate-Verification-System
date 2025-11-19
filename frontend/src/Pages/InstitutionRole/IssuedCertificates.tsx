import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ethers } from "ethers";

/* ---------- Types ---------- */
type BackendCert = {
  id: string | number;
  display_label?: string;
  issued_on?: string;
  applicant_full_name?: string;
  applicant_national_id_plain?: string | number;
  institution_name?: string;
  file_hash?: string;
  tx_hash?: string;
  block_number?: number | null;
};

type BlockchainStatus = {
  exists: boolean;
  revoked: boolean;
  applicantIdHash?: string;
  issuedAt?: number;
};

type Row = {
  id: string;
  applicant: string;
  nationalId: string;
  title: string;
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

/* ---------- Helpers ---------- */
const normHash = (h: string) =>
  !h ? "" : (h.startsWith("0x") ? h : "0x" + h).toLowerCase();

const REGISTRY_ABI = [
  "function revokeCertificate(string certificateHash) external",
];

/* =======================================================
   Component
======================================================= */
export default function IssuedCertificates() {
  /* Filters */
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "" | "ACTIVE" | "REVOKED" | "CHECKING"
  >("");

  /* Data */
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* Revoke modal */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState<Row | null>(null);
  const [revoking, setRevoking] = useState(false);

  /* Pagination */
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  /* ---------- Fetch Certificates ---------- */
  const fetchPage = async (pageNum: number) => {
    setLoading(true);
    setErr(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      if (q.trim()) params.set("search", q.trim());
      if (fromDate) params.set("issued_on__gte", fromDate);
      if (toDate) params.set("issued_on__lte", toDate);

      const res = await api<Paginated<BackendCert>>(
        `/certificates/institution/?${params.toString()}`
      );

      const mapped = res.results.map((d) => ({
        id: String(d.id),
        applicant: d.applicant_full_name || "—",
        nationalId: d.applicant_national_id_plain
          ? String(d.applicant_national_id_plain)
          : "—",
        title: d.display_label || "Untitled Certificate",
        issueDate: d.issued_on
          ? new Date(d.issued_on).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "",
        fileHash: d.file_hash || "",
        status: "CHECKING",
      }));

      setRows(mapped);
      setTotal(res.count || mapped.length);
      setCanNext(Boolean(res.next));
      setCanPrev(Boolean(res.previous));
      setLoading(false);

      if (mapped.length > 0) setTimeout(() => verifyOnChain(mapped), 80);
    } catch (e: any) {
      setErr(e?.userMessage || e?.message || "Failed to load certificates.");
      setLoading(false);
    }
  };

  /* ---------- Blockchain Verification ---------- */
  const verifyOnChain = async (certs: Row[]) => {
    try {
      setStatusLoading(true);

      const fileHashes = Array.from(
        new Set(certs.map((c) => normHash(c.fileHash)).filter(Boolean))
      );
      if (fileHashes.length === 0) return;

      const resp = await api<any>(
        "/certificates/institution/verify-batch/",
        {
          method: "POST",
          body: JSON.stringify({ file_hashes: fileHashes }),
        }
      );

      const items = resp?.results || (Array.isArray(resp) ? resp : []);

      const lookup = new Map<string, BlockchainStatus>();
      items.forEach((it: any) => {
        const hash = it?.file_hash || it?.fileHash;
        if (!hash) return;

        lookup.set(normHash(hash), {
          exists: !!it.exists,
          revoked: !!(it.revoked || it.is_revoked),
          applicantIdHash: it.applicant_id_hash || it.applicantIdHash,
          issuedAt: it.issue_date || it.issuedAt,
        });
      });

      setRows((prev) =>
        prev.map((r) => {
          const st = lookup.get(normHash(r.fileHash));
          if (!st) return { ...r, status: "INVALID" };
          if (!st.exists) return { ...r, status: "INVALID" };
          if (st.revoked) return { ...r, status: "REVOKED" };
          return { ...r, status: "ACTIVE" };
        })
      );
    } finally {
      setStatusLoading(false);
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
        alert("Contract address not found in your profile!");
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        contractAddress,
        REGISTRY_ABI,
        signer
      );

      const tx = await contract.revokeCertificate(row.fileHash);
      const receipt = await tx.wait();

      await api(
        `/certificates/institution/${encodeURIComponent(row.id)}/revoke/`,
        {
          method: "POST",
          body: JSON.stringify({
            tx_hash: tx.hash,
            block_number: receipt.blockNumber,
          }),
        }
      );

      await verifyOnChain([row]);
      alert("Certificate revoked successfully!");
    } catch (error: any) {
      let msg = error.reason || error.message || "Failed to revoke certificate";
      alert(msg);
    } finally {
      setRevoking(false);
    }
  };

  /* ---------- Modal Controls ---------- */
  const openConfirm = (row: Row) => {
    setConfirmRow(row);
    setConfirmOpen(true);
  };

  const confirmAndRevoke = async () => {
    if (confirmRow) await onRevoke(confirmRow);
    setConfirmOpen(false);
    setConfirmRow(null);
  };

  /* ---------- Load on change ---------- */
  useEffect(() => {
    fetchPage(page);
  }, [page, q, fromDate, toDate]);

  /* ---------- Local filter ---------- */
  const filteredData = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  /* 
  ==========================================================
                      UI  (UNCHANGED)
  ==========================================================
  */

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Issued{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">
            View, manage, and verify all certificates your institution has issued.
          </p>
        </div>

        {err && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            {err}
          </div>
        )}

        <div className="auth-card mt-0">
          {/* Filters */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              placeholder="Search by title, applicant..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 border border-gray-200"
            />

            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 border border-gray-200"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 border border-gray-200"
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Applicant</th>
                    <th className="px-4 py-3 text-left font-semibold">National ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                    <th className="px-4 py-3 text-left font-semibold w-24">View</th>
                    <th className="px-4 py-3 text-left font-semibold w-24">Revoke</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredData.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {r.applicant}
                        </td>

                        <td className="px-4 py-3 font-mono text-gray-700">
                          {r.nationalId}
                        </td>

                        <td className="px-4 py-3 text-gray-600">{r.title}</td>

                        <td className="px-4 py-3 text-gray-600">{r.issueDate}</td>

                        {/* View */}
                        <td className="px-4 py-3">
                          <Link
                            to={`/institution/certificates/${r.id}`}
                            className="inline-flex px-3 py-1.5 bg-indigo-600 text-white rounded-md text-xs"
                          >
                            View
                          </Link>
                        </td>

                        {/* Revoke */}
                        <td className="px-4 py-3">
                          {r.status === "ACTIVE" ? (
                            <button
                              onClick={() => openConfirm(r)}
                              disabled={revoking}
                              className="inline-flex px-3 py-1.5 bg-red-600 text-white rounded-md text-xs"
                            >
                              {revoking ? "Revoking..." : "Revoke"}
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {r.status === "CHECKING" && (
                            <span className="px-3 py-1.5 text-xs bg-gray-50 text-gray-600 rounded-full">
                              Checking…
                            </span>
                          )}

                          {r.status === "ACTIVE" && (
                            <span className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-full">
                              ACTIVE
                            </span>
                          )}

                          {r.status === "REVOKED" && (
                            <span className="px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-full">
                              REVOKED
                            </span>
                          )}

                          {r.status === "INVALID" && (
                            <span className="px-3 py-1.5 text-xs bg-amber-50 text-amber-700 rounded-full">
                              INVALID
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}

                  {!loading && filteredData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center">
                        No certificates found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredData.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg"
                >
                  Previous
                </button>

                <span className="text-sm text-gray-500">Page {page}</span>

                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!canNext}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-lg"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revoke Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setConfirmOpen(false)}
          />

          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-start gap-4 p-6 pb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-1">
                  Revoke Certificate
                </h2>
                <p className="text-sm text-gray-500">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Certificate
                  </span>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {confirmRow?.title}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Applicant
                  </span>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    {confirmRow?.applicant}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    National ID
                  </span>
                  <p className="text-sm font-mono font-semibold text-gray-900 mt-1">
                    {confirmRow?.nationalId}
                  </p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  <strong>Warning:</strong> Revoking this certificate will permanently mark it as invalid on the blockchain.
                </p>
              </div>
            </div>

            <div className="flex gap-3 px-6 pb-6">
              <button
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>

              <button
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                disabled={revoking}
                onClick={confirmAndRevoke}
              >
                {revoking ? "Revoking..." : "Revoke Certificate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
