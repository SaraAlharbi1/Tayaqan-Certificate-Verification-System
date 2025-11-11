import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Status = "PENDING" | "APPROVED" | "DECLINED";
type Row = {
  id: number;
  applicant_id: string;
  applicant_name?: string | null;
  applicant_email?: string | null;
  created_at: string;
  status: Status;
};

type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };

function StatusBadge({ status }: { status: Status }) {
  const p = {
    APPROVED: { bg: "bg-emerald-50", dot: "bg-emerald-500", text: "text-emerald-700", label: "Approved" },
    PENDING:  { bg: "bg-amber-50",  dot: "bg-amber-500",  text: "text-amber-700",  label: "Pending"  },
    DECLINED: { bg: "bg-red-50",   dot: "bg-red-500",   text: "text-red-700",   label: "Declined" },
  } as const;
  const m = p[status];
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${m.bg} ${m.text}`}>
      <span className={`inline-block w-2 h-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export default function AccessRequests() {
  const navigate = useNavigate();
  const [data, setData] = useState<Page<Row> | null>(null);
  const [pageUrl, setPageUrl] = useState("/employer/requests/");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | Status>("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const path = pageUrl.startsWith("/api") ? pageUrl.replace("/api", "") : pageUrl;
        const res = await api<Page<Row>>(path);
        if (!cancel) {
          setData(res);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancel) {
          setError(e?.userMessage || e?.message || "Failed to load requests");
          setLoading(false);
        }
      }
    })();
    return () => { cancel = true; };
  }, [pageUrl]);

  const items = data?.results ?? [];
  const filtered = useMemo(() => {
    let result = items;
    
    // Filter by search query
    if (q) {
      result = result.filter(r => {
        const n = (r.applicant_name || "").toLowerCase();
        const id = (r.applicant_id || "").toLowerCase();
        const dt = (r.created_at || "").toLowerCase();
        return n.includes(q) || id.includes(q) || dt.includes(q) || r.status.toLowerCase().includes(q);
      });
    }
    
    // Filter by status
    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter);
    }
    
    return result;
  }, [q, statusFilter, items]);

  const goto = (href: string | null) => {
    if (!href) return;
    const u = new URL(href, window.location.origin);
    setPageUrl(u.pathname + (u.search || ""));
  };

  // Count by status
  const statusCounts = useMemo(() => {
    return {
      APPROVED: items.filter(r => r.status === "APPROVED").length,
      PENDING: items.filter(r => r.status === "PENDING").length,
      DECLINED: items.filter(r => r.status === "DECLINED").length,
    };
  }, [items]);

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Access <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Requests</span>
            </h1>
            <p className="mt-1 text-gray-500">Request and view access to applicant certificates</p>
          </div>
          <Link 
            to="/employer/access/new" 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Link>
        </div>

        {/* Info Banner - only show if no requests yet */}
        {data && data.count === 0 && !loading && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
            <div className="flex gap-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">How Access Requests Work</h3>
                <div className="text-sm text-blue-800 space-y-2">
                  <p><strong>1.</strong> Create a request by entering an applicant's National ID</p>
                  <p><strong>2.</strong> The applicant will receive a notification and can approve or decline</p>
                  <p><strong>3.</strong> Once approved, you can view their shared certificates</p>
                </div>
                <Link 
                  to="/employer/access/new"
                  className="inline-flex items-center gap-2 mt-3 text-sm font-semibold text-blue-700 hover:text-blue-900"
                >
                  Create your first request
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Approved</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{statusCounts.APPROVED}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{statusCounts.PENDING}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-lg">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Declined</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{statusCounts.DECLINED}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Main Card */}
        <div className="auth-card mt-0">
          {/* Quick Status Filters */}
          {data && data.count > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter("")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "" 
                    ? "bg-indigo-600 text-white" 
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All ({data.count})
              </button>
              <button
                onClick={() => setStatusFilter("APPROVED")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "APPROVED" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                Approved ({statusCounts.APPROVED})
              </button>
              <button
                onClick={() => setStatusFilter("PENDING")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "PENDING" 
                    ? "bg-amber-600 text-white" 
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                }`}
              >
                Pending ({statusCounts.PENDING})
              </button>
              <button
                onClick={() => setStatusFilter("DECLINED")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === "DECLINED" 
                    ? "bg-red-600 text-white" 
                    : "bg-red-50 text-red-700 hover:bg-red-100"
                }`}
              >
                Declined ({statusCounts.DECLINED})
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="mb-4 flex gap-3">
            <div className="flex-1">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, National ID, or date..."
                className="w-full h-12 rounded-xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-indigo-500 border border-gray-200"
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl">
              <span className={`inline-block h-2 w-2 rounded-full ${loading ? "bg-amber-500" : "bg-emerald-500"}`} />
              <span className="text-sm font-medium text-slate-700">
                {loading ? "Loading..." : `${filtered.length} ${filtered.length === 1 ? 'result' : 'results'}`}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Applicant</th>
                    <th className="px-4 py-3 text-left font-semibold">National ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Created</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">
                    <div className="flex justify-end"> <span className="inline-block w-[168px] text-left">View</span> </div></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        <div className="inline-flex items-center gap-3">
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Loading...
                        </div>
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.map(r => {
                    const isApproved = r.status === "APPROVED";
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{r.applicant_name || "—"}</div>
                          {r.applicant_email && <div className="text-xs text-gray-500 mt-0.5">{r.applicant_email}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-gray-700">{r.applicant_id}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(r.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {isApproved ? (
                              <button
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors duration-200"
                                onClick={() => navigate(`/employer/applicants/${r.id}/shared`)}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                View Certificates
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500 italic">
                                {r.status === "PENDING" ? "Waiting for approval" : "Request declined"}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-gray-500 font-medium">No access requests found</p>
                            <p className="text-sm text-gray-400 mt-1">
                              {search || statusFilter ? "Try adjusting your filters" : "Create your first request to get started"}
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
            {!loading && filtered.length > 0 && (
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t border-gray-200">
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={!data?.previous} 
                  onClick={() => goto(data?.previous!)}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <div className="text-sm text-gray-500">
                  Showing {filtered.length} of {data?.count || 0} requests
                </div>
                <button 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  disabled={!data?.next} 
                  onClick={() => goto(data?.next!)}
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