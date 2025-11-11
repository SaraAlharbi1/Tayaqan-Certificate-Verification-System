// src/Pages/EmployerRole/ApplicantSharedCertificates.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

/* ----------------------------- Types ----------------------------- */
type Certificate = {
  id: number;
  title: string;
  issuer: string;
  issued_on?: string | null;
  serial_number?: string | null;
  status?: "ACTIVE" | "REVOKED";
  pdf_url?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/* ----------------------------- Main Component ----------------------------- */
export default function ApplicantSharedCertificates() {
  const { applicantId = "" } = useParams<{ applicantId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [pageUrl, setPageUrl] = useState(`/employer/requests/${applicantId}/shared/`);
  const [data, setData] = useState<Paginated<Certificate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

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
        const raw = await api<Paginated<any>>(path);

        const mapped: Paginated<Certificate> = {
          ...raw,
          results: (raw.results ?? []).map((r: any): Certificate => {
            const issuer =
              r.issuer_name ??
              r.issuerName ??
              (typeof r.issuer === "string" ? r.issuer : r.issuer?.name) ??
              r.institution_name ??
              (typeof r.institution === "string" ? r.institution : r.institution?.name) ??
              "—";

            return {
              id: r.id,
              title: r.title ?? r.display_label ?? `Certificate #${r.id}`,
              issuer,
              issued_on: r.issued_on ?? r.issueDate ?? null,
              serial_number: r.serial_number ?? r.serial ?? null,
              status: r.status ?? (r.is_revoked ? "REVOKED" : "ACTIVE"),
              pdf_url: r.file_url ?? r.pdf_url ?? null,
            };
          }),
        };

        if (!cancel) {
          setData(mapped);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancel) {
          setError(err?.userMessage || err?.message || "Failed to load certificates.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [pageUrl]);

  // Filter certificates
  const filtered = useMemo(() => {
    const items = data?.results ?? [];
    
    // Search filter only
    if (!q) return items;
    
    return items.filter((cert) => {
      const title = (cert.title || "").toLowerCase();
      const issuer = (cert.issuer || "").toLowerCase();
      const serial = (cert.serial_number || "").toLowerCase();
      const date = cert.issued_on
        ? new Date(cert.issued_on).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }).toLowerCase()
        : "";
      
      return title.includes(q) || issuer.includes(q) || serial.includes(q) || date.includes(q);
    });
  }, [q, data?.results]);

  const goto = (href: string | null) => {
    if (!href) return;
    const u = new URL(href, window.location.origin);
    setPageUrl(u.pathname + (u.search || ""));
  };

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Shared{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Certificates
              </span>
            </h1>
            <p className="mt-1 text-gray-500">
              Certificates shared by the applicant
            </p>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-outline"
          >
            ← Back
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-700 hover:text-red-900 ml-4"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Main Card */}
        <div className="auth-card mt-0">
          {/* Search Bar */}
          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, issuer, or serial..."
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

            {/* Status Indicator */}
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 whitespace-nowrap">
              <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
              {loading ? "Loading..." : `${data?.count ?? 0} total`}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Certificate Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Issuer</th>
                    <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Serial</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold w-28">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    // Loading skeleton
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-32" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-20" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-gray-200 rounded w-16 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filtered.length > 0 ? (
                    filtered.map((cert) => {
                      const isRevoked = cert.status === "REVOKED";
                      return (
                        <tr key={cert.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{cert.title}</td>
                          <td className="px-4 py-3 text-gray-600">{cert.issuer}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {cert.issued_on
                              ? new Date(cert.issued_on).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-700">
                            {cert.serial_number || "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                                isRevoked
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  isRevoked ? "bg-red-500" : "bg-emerald-500"
                                }`}
                              />
                              {isRevoked ? "REVOKED" : "ACTIVE"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
  <Link
    to={`/employer/certificates/${cert.id}`}
    state={{ from: location.pathname, pdf: cert.pdf_url }}
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
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div>
                            <p className="text-gray-500 font-medium">No certificates found</p>
                            <p className="text-sm text-gray-400 mt-1">
                              {q ? "Try adjusting your search" : "No certificates have been shared for this request"}
                            </p>
                          </div>
                          {q && (
                            <button
                              onClick={() => setSearch("")}
                              className="mt-2 btn btn-outline text-sm"
                            >
                              Clear Search
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
                  Showing {filtered.length} of {data?.count ?? 0}
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