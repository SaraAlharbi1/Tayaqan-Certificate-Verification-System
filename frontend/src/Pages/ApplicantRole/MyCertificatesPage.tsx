import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

/* ---------------------- Types ---------------------- */
type BackendCert = {
  id: string | number;
  display_label?: string | null;
  certificate_type?: string | null;
  institution_name?: string | null;
  issued_on?: string | null;
  file_hash?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
};

type Row = {
  id: string;
  title: string;
  type: string;
  issuer: string;
  issueDate: string;
  fileHash: string;
  status: "ACTIVE" | "REVOKED" | "CHECKING" | "INVALID";
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/* ---------------------- Helpers ---------------------- */
const normHash = (h: string) =>
  !h ? "" : (h.startsWith("0x") ? h : "0x" + h).toLowerCase();

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  const t = new Date(d);
  return isNaN(t.getTime())
    ? d
    : t.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

/* ---------------------- Components ---------------------- */
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
   My Certificates (Applicant)
======================================================= */
export default function MyCertificatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "REVOKED">("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  /* ------------------ Fetch certificates ------------------ */
  const fetchCertificates = async (pageNum: number) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await api<Paginated<BackendCert>>(`/certificates/my/?${params.toString()}`);

      const mapped: Row[] = (res.results ?? []).map((d) => ({
        id: String(d.id),
        title: d.display_label || "Untitled Certificate",
        type: d.certificate_type || "",
        issuer: d.institution_name || "—",
        issueDate: formatDate(d.issued_on),
        fileHash: d.file_hash || "",
        status: "CHECKING" as const,
      }));

      setRows(mapped);
      setTotal(res.count ?? mapped.length);
      setCanNext(Boolean(res.next));
      setCanPrev(Boolean(res.previous));
      setLoading(false);

      // Verify on blockchain
      if (mapped.length > 0) {
        verifyOnBlockchain(mapped);
      }
    } catch (e: any) {
      setError(e?.userMessage || e?.message || "Failed to load certificates.");
      setLoading(false);
    }
  };

  /* ------------------ Blockchain verification ------------------ */
  const verifyOnBlockchain = async (certs: Row[]) => {
    try {
      const fileHashes = Array.from(
        new Set(certs.map((c) => normHash(c.fileHash)).filter(Boolean))
      );

      if (fileHashes.length === 0) return;

      const resp = await api<any>("/certificates/my/verify-batch/", {
        method: "POST",
        body: JSON.stringify({ file_hashes: fileHashes }),
      });

      const results = resp?.results || resp || [];
      const statusMap: Record<string, "ACTIVE" | "REVOKED" | "INVALID"> = {};

      for (const r of results) {
        const h = normHash(r.file_hash || r.fileHash || "");
        if (!h) continue;

        if (!r.exists) {
          statusMap[h] = "INVALID";
        } else if (r.is_revoked || r.revoked) {
          statusMap[h] = "REVOKED";
        } else {
          statusMap[h] = "ACTIVE";
        }
      }

      setRows((prev) =>
        prev.map((row) => ({
          ...row,
          status: statusMap[normHash(row.fileHash)] || "INVALID",
        }))
      );
    } catch (e) {
      console.error("Blockchain verification failed:", e);
    }
  };

  /* ------------------ Effects ------------------ */
  useEffect(() => {
    fetchCertificates(page);
  }, [page, searchQuery]);

  /* ------------------ Filter locally ------------------ */
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

  /* --------------------------- UI --------------------------- */
  return (
    <section className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            My{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">View and manage your issued certificates</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search certificates..."
              value={searchQuery}
              onChange={(e) => {
                setPage(1);
                setSearchQuery(e.target.value);
              }}
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === ""
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === "" ? "bg-indigo-500" : "bg-gray-200"
            }`}>
              {counts.all}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Active
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === "ACTIVE" ? "bg-emerald-400" : "bg-gray-200"
            }`}>
              {counts.active}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter("REVOKED")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === "REVOKED"
                ? "bg-red-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Revoked
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === "REVOKED" ? "bg-red-400" : "bg-gray-200"
            }`}>
              {counts.revoked}
            </span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
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
              {statusFilter ? `No ${statusFilter.toLowerCase()} certificates` : "No certificates yet"}
            </h3>
            <p className="text-gray-500">
              {statusFilter ? "Try selecting a different filter" : "Your certificates will appear here once issued"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Certificate
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Issuer
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Issue Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{row.title}</p>
                            {row.type && <p className="text-sm text-gray-500">{row.type}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{row.issuer}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{row.issueDate}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/applicant/certificates/${row.id}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {(canPrev || canNext) && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {filteredRows.length} of {total} certificates
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={!canPrev}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!canNext}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}