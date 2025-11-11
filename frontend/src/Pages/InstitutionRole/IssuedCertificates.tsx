// src/Pages/InstitutionRole/IssuedCertificates.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

/* ---------------------- Types ---------------------- */
type BackendCert = {
  id: string | number;

  // applicant fields
  applicant_full_name?: string;
  applicant_name?: string;
  applicant?: { full_name?: string; name?: string; national_id_plain?: string };

  // sometimes exposed at root
  national_id_plain?: string;

  display_label?: string;
  issued_on?: string;
  serial_number?: string;
  file_hash?: string;
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
  serial: string;
  fileHash: string;
  status: "CHECKING" | "ACTIVE" | "REVOKED" | "INVALID";
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

const pickApplicantName = (d: BackendCert) =>
  d.applicant_full_name ||
  d.applicant_name ||
  d.applicant?.full_name ||
  d.applicant?.name ||
  "—";

const pickApplicantNID = (d: BackendCert) =>
  d.national_id_plain || d.applicant?.national_id_plain || "—";

/* =======================================================
   Issued Certificates (Institution)
======================================================= */
export default function IssuedCertificates() {
  // filters
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "REVOKED" | "CHECKING">("");

  // data + ui state
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  /* ------------------ Fetch list (DB only) ------------------ */
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
        `/institution/certificates/?${params.toString()}`,
        { method: "GET" }
      );

      const list = res.results ?? [];
      const mapped: Row[] = list.map((d) => ([
        String(d.id),
        pickApplicantName(d),
        pickApplicantNID(d),
        d.display_label || "Untitled Certificate",
        d.issued_on
          ? new Date(d.issued_on).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "",
        d.serial_number || "",
        d.file_hash || "",
      ] as const)).map(([id, applicant, nationalId, title, issueDate, serial, fileHash]) => ({
        id,
        applicant,
        nationalId,
        title,
        issueDate,
        serial,
        fileHash,
        status: "CHECKING",
      }));

      setRows(mapped);
      setTotal(res.count ?? mapped.length);
      setCanNext(Boolean(res.next));
      setCanPrev(Boolean(res.previous));
      setLoading(false);

      if (mapped.length > 0) setTimeout(() => verifyOnChain(mapped), 100);
    } catch (e: any) {
      setErr(e?.userMessage || e?.message || "Failed to load certificates.");
      setLoading(false);
    }
  };

  /* ------------------ Verify on blockchain ------------------ */
  const verifyOnChain = async (certs: Row[]) => {
    try {
      setStatusLoading(true);

      const fileHashes = Array.from(
        new Set(certs.map((c) => normHash(c.fileHash)).filter(Boolean))
      );
      if (fileHashes.length === 0) {
        setStatusLoading(false);
        return;
      }

      const resp = await api<any>("/institution/certificates/verify-batch/", {
        method: "POST",
        body: JSON.stringify({ file_hashes: fileHashes }),
      });

      const lookup = new Map<string, BlockchainStatus>();
      if (Array.isArray(resp)) {
        for (const it of resp) {
          if (!it?.fileHash) continue;
          lookup.set(normHash(it.fileHash), {
            exists: !!it.exists,
            revoked: !!it.revoked,
            applicantIdHash: it.applicantIdHash,
            issuedAt: it.issuedAt,
          });
        }
      } else if (resp && typeof resp === "object") {
        for (const [k, v] of Object.entries(resp)) {
          lookup.set(normHash(k), {
            exists: !!(v as any).exists,
            revoked: !!(v as any).revoked,
            applicantIdHash: (v as any).applicantIdHash,
            issuedAt: (v as any).issuedAt,
          });
        }
      }

      setRows((prev) =>
        prev.map((r) => {
          const st = lookup.get(normHash(r.fileHash));
          if (!st) return { ...r, status: "INVALID" as const };
          if (!st.exists) return { ...r, status: "INVALID" as const };
          if (st.revoked) return { ...r, status: "REVOKED" as const };
          return { ...r, status: "ACTIVE" as const };
        })
      );
    } finally {
      setStatusLoading(false);
    }
  };

  /* ------------------ Revoke (on-chain) ------------------ */
  const onRevoke = async (row: Row) => {
    try {
      await api(`/institution/certificates/${encodeURIComponent(row.id)}/revoke/`, {
        method: "POST",
      });
      await verifyOnChain([row]);
    } catch (e: any) {
      alert(e?.userMessage || e?.message || "Failed to revoke.");
    }
  };

  /* ------------------ Effect: fetch on change ------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchPage(page);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.userMessage || e?.message || "Failed to load certificates.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, fromDate, toDate]);

  /* ------------------ Local status filter ------------------ */
  const filteredData = useMemo(() => {
    if (!statusFilter) return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  /* --------------------------- UI --------------------------- */
  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Issued{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">All certificates your institution issued</p>
        </div>

        {err && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            {err}
          </div>
        )}

        <div className="auth-card mt-0">
          {/* Status chips */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === ""
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === "ACTIVE"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter("REVOKED")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === "REVOKED"
                  ? "bg-red-600 text-white"
                  : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              Revoked
            </button>
          </div>

          {/* Filters */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              placeholder="Search by title, serial, applicant..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 border border-gray-200"
            />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 border border-gray-200"
            />
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 border border-gray-200"
            />
          </div>

          {/* Status bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  loading ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              <span className="text-sm font-medium text-slate-700">
                {loading ? "Loading..." : `${filteredData.length} certificates`}
              </span>
            </div>

            {statusLoading && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl text-sm text-blue-700">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying on blockchain...
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Applicant</th>
                    <th className="px-4 py-3 text-left font-semibold">National ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Serial</th>
                    <th className="px-4 py-3 text-left font-semibold w-28">View</th>
                    <th className="px-4 py-3 text-left font-semibold w-28">Revoke</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                        <div className="inline-flex items-center gap-3">
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Loading...
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredData.map((r) => {
                      const isChecking = r.status === "CHECKING";
                      const isActive = r.status === "ACTIVE";
                      const isRevoked = r.status === "REVOKED";
                      const isInvalid = r.status === "INVALID";

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                          <td
                            className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap truncate max-w-[220px]"
                            title={r.applicant}
                          >
                            {r.applicant}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.nationalId}</td>
                          <td className="px-4 py-3 text-gray-600">{r.title}</td>
                          <td className="px-4 py-3 text-gray-600">{r.issueDate}</td>
                          <td className="px-4 py-3 font-mono text-gray-700 text-xs">{r.serial}</td>

                          {/* View */}
                          <td className="px-4 py-3">
                            <Link
                              to={`/institution/certificates/${encodeURIComponent(r.id)}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                              View
                            </Link>
                          </td>

                          {/* Revoke */}
                          <td className="px-4 py-3">
                            {isActive ? (
                              <button
                                onClick={() => {
                                  const ok = window.confirm(
                                    `Revoke "${r.title}"?\nApplicant: ${r.applicant}`
                                  );
                                  if (ok) onRevoke(r);
                                }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-red-600 text-red-600 hover:bg-red-600 hover:text-white text-xs font-medium rounded-md transition-colors"
                              >
                                Revoke
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400 italic">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {isChecking && (
                              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-gray-50 text-gray-600">
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  />
                                </svg>
                                Checking...
                              </span>
                            )}
                            {isActive && (
                              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                ACTIVE
                              </span>
                            )}
                            {isRevoked && (
                              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                REVOKED
                              </span>
                            )}
                            {isInvalid && (
                              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700">
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                INVALID
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && filteredData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                          <div>
                            <p className="text-gray-500 font-medium">No certificates found</p>
                            <p className="text-sm text-gray-400 mt-1">
                              {q || fromDate || toDate ? "Try adjusting your filters" : "Issued certificates will appear here"}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredData.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPage((p) => (p > 1 ? p - 1 : 1))}
                  disabled={!canPrev || loading}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <div className="text-sm text-gray-500">Page {page}</div>
                <button
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading || !canNext}
                >
                  Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
