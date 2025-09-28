// src/Pages/ApplicantRole/AccessReqused.tsx
import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";

type AccessReq = {
  id: number;
  company: string;
  applicantId: string;
  date: string; // YYYY-MM-DD
};

export default function AccessReqused() {
  
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
    
    <section className="px-6 pt-3 pb-10 -mt-4 md:-mt-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl md:text-4xl font-bold text-blue-900">Share Access</h1>
        <p className="mt-1">
          <span className="text-indigo-600 font-semibold">Select</span>{" "}
          request
        </p>

        
        <div className="mt-5 mb-5">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 pr-20 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
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
        </div>

        {/* الجدول */}
        <div className="overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left text-sm font-semibold text-gray-600">
                <th className="px-6 py-3">Company Name</th>
                <th className="px-6 py-3">Applicant ID</th>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-6 py-4">{r.company}</td>
                  <td className="px-6 py-4">{r.applicantId}</td>
                  <td className="px-6 py-4">
                    {new Date(r.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                   
                    <Link
                      to={`/applicant/requests/${r.id}`}
                      className="inline-block rounded-lg bg-indigo-600 px-4 py-1 text-sm text-white hover:bg-indigo-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No requests match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
