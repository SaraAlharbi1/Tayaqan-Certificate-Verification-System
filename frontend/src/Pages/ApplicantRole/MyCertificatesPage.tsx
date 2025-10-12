// src/Pages/ApplicantRole/MyCertificatesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

/* ---- Types ---- */
type BackendCert = {
  id: string | number;
  title?: string;           // MyCertificateListSerializer
  issuerName?: string;
  issueDate?: string;       // YYYY-MM-DD
  serial?: string;
  is_revoked?: boolean;
};
type Row = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  serial: string;
  status: "ACTIVE" | "REVOKED";
};
type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

/* ---- Constants (match institution page) ---- */
const ACTIVE_BACKEND_STATUSES = ["ISSUED_ONCHAIN"];

export default function MyCertificatesPage() {
  const [q, setQ] = useState("");

  // filters (same UX as IssuedCertificates)
  const [status, setStatus] = useState<"" | "ACTIVE" | "REVOKED">("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  /* ---- Fetch ---- */
  const fetchPage = async (pageNum: number) => {
    setLoading(true);
    setErr(null);

    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    if (q.trim()) params.set("search", q.trim());

    // server-side filters (identical pattern to IssuedCertificates)
    if (status === "REVOKED") params.set("status", "REVOKED");
    else if (status === "ACTIVE") params.set("status__in", ACTIVE_BACKEND_STATUSES.join(","));
    if (fromDate) params.set("issued_on__gte", fromDate);
    if (toDate) params.set("issued_on__lte", toDate);

    const res = await api<Paginated<BackendCert>>(`/my/certificates/?${params.toString()}`, {
      method: "GET",
    });

    const list = res.results ?? [];
    const mapped: Row[] = list.map((d) => ({
      id: String(d.id),
      title: d.title ?? "",
      issuer: d.issuerName ?? "—",
      issueDate: d.issueDate ? new Date(d.issueDate).toLocaleDateString() : "",
      serial: d.serial ?? "",
      status: d.is_revoked ? "REVOKED" : "ACTIVE",
    }));

    setRows(mapped);
    setTotal(res.count ?? mapped.length);
    setCanNext(Boolean(res.next));
    setCanPrev(Boolean(res.previous));
    setLoading(false);
  };

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
  }, [page, q, status, fromDate, toDate]);

  const data = useMemo(() => rows, [rows]);

  /* ---- UI (cloned layout; no Revoke, no Download) ---- */
  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            My{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Your issued certificates</p>
        </div>

        {/* Card */}
        <div className="auth-card mt-0">
          {/* Top bar: search + total */}
          <div className="mb-4 flex items-center gap-3">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input
              id="search"
              placeholder="Search by title, serial…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              className="flex-1 h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
            />
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  loading ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              {loading ? "Loading…" : `${total} total`}
            </span>
          </div>

          {/* Filters row (same controls) */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Status */}
            <div>
              <label className="sr-only" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as "" | "ACTIVE" | "REVOKED");
                }}
                className="w-full h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REVOKED">REVOKED</option>
              </select>
            </div>

            {/* From date */}
            <div>
              <label className="sr-only" htmlFor="fromDate">
                From
              </label>
              <input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setPage(1);
                  setFromDate(e.target.value);
                }}
                className="w-full h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
              />
            </div>

            {/* To date */}
            <div>
              <label className="sr-only" htmlFor="toDate">
                To
              </label>
              <input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setPage(1);
                  setToDate(e.target.value);
                }}
                className="w-full h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Issuer</th>
                    <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Serial</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                        Loading…
                      </td>
                    </tr>
                  )}

                  {!loading && err && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-red-600">
                        {err}
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !err &&
                    data.map((r) => {
                      const revoked = r.status === "REVOKED";
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3">{r.title}</td>
                          <td className="px-4 py-3">{r.issuer}</td>
                          <td className="px-4 py-3">{r.issueDate}</td>
                          <td className="px-4 py-3">{r.serial}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                                revoked ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  revoked ? "bg-red-500" : "bg-emerald-500"
                                }`}
                              />
                              {revoked ? "REVOKED" : "ACTIVE"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link
                                to={`/applicant/certificates/${encodeURIComponent(r.id)}`}
                                className="btn btn-outline"
                              >
                                View
                              </Link>
                              {/* No revoke, no download */}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && !err && data.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-16 text-center text-gray-500">
                        No certificates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination (no Math.max) */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">Page {page}</div>
            <div className="flex gap-2">
              <button
                className="btn btn-outline"
                onClick={() => setPage((p) => (p > 1 ? p - 1 : 1))}
                disabled={!canPrev || loading}
              >
                Previous
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || !canNext}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
