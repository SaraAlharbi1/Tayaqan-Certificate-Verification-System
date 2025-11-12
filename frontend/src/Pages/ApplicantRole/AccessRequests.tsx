// src/Pages/ApplicantRole/AccessRequests.tsx
import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

/* ----------------------------- Types ----------------------------- */
type AccessReq = {
  id: number;
  status: "PENDING" | "APPROVED" | "DECLINED";
  created_at: string;
  company?: string | null;
  company_name?: string | null;
  applicant_id?: string | null;
  national_id_plain?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/* ----------------------------- Constants ----------------------------- */
const STATUS_STYLES = {
  PENDING: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  APPROVED: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  DECLINED: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
} as const;

/* ----------------------------- Main Component ----------------------------- */
export default function AccessRequests() {
  const [data, setData] = useState<Paginated<AccessReq> | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "PENDING" | "APPROVED" | "DECLINED">("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [pageUrl, setPageUrl] = useState("/my/requests/");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const path = pageUrl.startsWith("/api") ? pageUrl.replace("/api", "") : pageUrl;
        const res = await api<Paginated<AccessReq>>(path);
        if (!cancel) {
          setData(res);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancel) {
          setError(err?.userMessage || err?.message || "Failed to load requests");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [pageUrl, status, fromDate, toDate]);

  // Filter results
  const filtered = useMemo(() => {
    const items = data?.results ?? [];
    let result = items;

    if (status) result = result.filter((r) => r.status === status);

    if (fromDate) {
      const fromTs = new Date(fromDate).getTime();
      result = result.filter((r) => new Date(r.created_at).getTime() >= fromTs);
    }
    if (toDate) {
      const toTs = new Date(toDate).getTime();
      result = result.filter((r) => new Date(r.created_at).getTime() <= toTs);
    }

    if (!q) return result;
    return result.filter((r) => {
      const company = (r.company || r.company_name || "").toLowerCase();
      const applicantId = (r.applicant_id || r.national_id_plain || "").toLowerCase();
      const statusText = r.status.toLowerCase();
      const date = new Date(r.created_at).toLocaleDateString().toLowerCase();
      return company.includes(q) || applicantId.includes(q) || statusText.includes(q) || date.includes(q);
    });
  }, [q, status, fromDate, toDate, data?.results]);

  const goto = (href: string | null) => {
    if (!href) return;
    const u = new URL(href, window.location.origin);
    setPageUrl(u.pathname + u.search);
  };

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Access{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Requests
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Manage incoming requests from employers</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between" role="alert">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setPageUrl(pageUrl)}
              className="text-sm font-medium text-red-700 hover:text-red-900 underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        <div className="auth-card mt-0">
          {/* Quick Status Filters */}
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              onClick={() => setStatus("")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === "" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatus("PENDING")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === "PENDING" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setStatus("APPROVED")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === "APPROVED" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => setStatus("DECLINED")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                status === "DECLINED" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"
              }`}
            >
              Declined
            </button>
          </div>

          {/* Search and Date Filters */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <input
                id="access-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company, ID..."
                className="w-full h-12 rounded-xl bg-gray-50 pl-11 pr-10 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 border border-gray-200"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200"
                  aria-label="Clear search"
                >
                  <svg className="h-4 w-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>

            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              placeholder="From date"
              className="h-12 rounded-xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 border border-gray-200"
            />

            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              placeholder="To date"
              className="h-12 rounded-xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 border border-gray-200"
            />
          </div>

          {/* Status Indicator */}
          <div className="mb-4 flex items-center justify-end">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
              <span className={`inline-block h-2 w-2 rounded-full ${loading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-sm font-medium text-slate-700">
                {loading ? "Loading..." : `${data?.count ?? 0} total`}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Company</th>
                    <th className="px-4 py-3 text-left font-semibold">Applicant ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                      </tr>
                    ))
                  ) : filtered.length > 0 ? (
                    filtered.map((r) => {
                      const style = STATUS_STYLES[r.status];
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3 font-medium">
                            {r.company ?? r.company_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                            {r.applicant_id ?? r.national_id_plain ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to={`/applicant/requests/${r.id}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center">
                        <div className="text-gray-400">
                          <svg className="mx-auto h-12 w-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm font-medium text-gray-900">
                            {q || status || fromDate || toDate ? "No matching requests" : "No access requests"}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            {q || status || fromDate || toDate ? "Try adjusting your filters" : "You don't have any requests yet"}
                          </p>
                          {(q || status || fromDate || toDate) && (
                            <button
                              onClick={() => {
                                setSearch("");
                                setStatus("");
                                setFromDate("");
                                setToDate("");
                              }}
                              className="mt-3 btn btn-outline text-sm"
                            >
                              Clear All Filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filtered.length > 0 && (
              <div className="p-3 flex items-center justify-between border-t border-gray-100">
                <button
                  className="btn btn-outline disabled:opacity-50"
                  disabled={!data?.previous}
                  onClick={() => goto(data?.previous!)}
                >
                  Previous
                </button>
                <div className="text-xs text-gray-500">
                  {filtered.length} / {data?.count ?? 0}
                </div>
                <button
                  className="btn btn-outline disabled:opacity-50"
                  disabled={!data?.next}
                  onClick={() => goto(data?.next!)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
