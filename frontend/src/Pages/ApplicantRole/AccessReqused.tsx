import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";


type RequestRow = {
  id: number | string;
  company: string;
  applicantId: string;
  date: string; // YYYY-MM-DD
};

export default function AccessReqused() {
  
  const [rows] = useState<RequestRow[]>([
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
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.company.toLowerCase().includes(q) ||
        r.applicantId.toLowerCase().includes(q) ||
        r.date.toLowerCase().includes(q)
    );
  }, [q, rows]);

  return (
    <section className="bg-gradient-to-b from-white to-surface px-6 py-12">
      <div className="mx-auto max-w-6xl">
        
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">
          Share Access
        </h1>
        <p className="mb-6">
          <span className="font-semibold text-indigo-700">Select</span> request
        </p>

        
        <div className="rounded-2xl bg-white shadow ring-1 ring-slate-200 p-6">
          
          <div className="mb-5">
            <div className="relative">
              <input
                type="text"
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

         
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 text-left text-sm font-semibold text-gray-600">
                  <th className="px-6 py-3 rounded-l-lg">Company Name</th>
                  <th className="px-6 py-3">Applicant ID</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 rounded-r-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-6 py-3">{r.company}</td>
                    <td className="px-6 py-3">{r.applicantId}</td>
                    <td className="px-6 py-3">
                      {new Date(r.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                     

<td className="px-6 py-3">
  <Link
    to={`/applicant/requests/${r.id}`}   
    className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-4 py-1 text-white text-sm shadow hover:bg-indigo-600"
  >
    View
  </Link>
</td>
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
      </div>
    </section>
  );
}
