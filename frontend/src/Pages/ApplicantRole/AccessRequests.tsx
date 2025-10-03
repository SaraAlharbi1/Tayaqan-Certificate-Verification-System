// src/Pages/ApplicantRole/AccessRequests.tsx
import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";

type AccessReq = {
  id: number;
  company: string;
  applicantId: string;
  date: string; // YYYY-MM-DD
};

export default function AccessRequests() {
  const [items] = useState<AccessReq[]>([
    { id: 1, company: "STC",    applicantId: "1120880093", date: "2024-06-15" },
    { id: 2, company: "Amazon", applicantId: "1120880093", date: "2023-09-20" },
    { id: 3, company: "Oracle", applicantId: "1120880093", date: "2023-09-20" },
    { id: 4, company: "Google", applicantId: "1120880093", date: "2023-09-20" },
  ]);

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!q) return items;
    return items.filter(
      (r) =>
        r.company.toLowerCase().includes(q) ||
        r.applicantId.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q)
    );
  }, [q, items]);

  return (
    <section className="pt-2 md:pt-3 -mt-6 md:-mt-10 pb-10">
      <div className="mx-auto max-w-6xl px-6">
        {/* Page title — consistent style */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
          Share{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Access
          </span>
        </h1>
        <p className="text-gray-600 mb-4">
          <span className="text-indigo-600 font-semibold">Select</span> a request to view details
        </p>

        {/* Card (search header + table) */}
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          {/* Search header */}
          <div className="p-4 border-b border-gray-100">
            <label htmlFor="access-search" className="sr-only">
              Search requests
            </label>
            <div className="relative">
              <input
                id="access-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company, applicant ID, or date"
                className="w-full h-12 rounded-xl border border-gray-200 bg-white px-4 pr-20 outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              Showing {filtered.length} of {items.length}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Company Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Applicant ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Date</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">{r.company}</td>
                    <td className="px-4 py-3">{r.applicantId}</td>
                    <td className="px-4 py-3">
                      {new Date(r.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Link
                          to={`/applicant/requests/${r.id}`}
                          className="btn btn-secondary"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No requests match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
