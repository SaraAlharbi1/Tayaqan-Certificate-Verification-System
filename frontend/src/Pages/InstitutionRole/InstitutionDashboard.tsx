// src/pages/institution/InstitutionDashboard.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

/** Row shape for an uploaded certificate */
type Row = {
  certificateId: string;     // used in the route
  applicantName: string;
  nationalId: string;
  title: string;
  issueDate: string;         // e.g., "15-06-2024"
};

/** Mock data (replace with API call) */
const MOCK: Row[] = [
  { certificateId: "cert-1001", applicantName: "Rawan Mohammed", nationalId: "1234567", title: "Blockchain Technology", issueDate: "15-06-2024" },
  { certificateId: "cert-1002", applicantName: "Fatima Rajh",    nationalId: "2468100", title: "Data Science Essentials", issueDate: "20-09-2023" },
  { certificateId: "cert-1003", applicantName: "Sara Sultan",    nationalId: "6001003", title: "Learning",                issueDate: "20-09-2023" },
  { certificateId: "cert-1004", applicantName: "Njood Alharbi",  nationalId: "5436900", title: "Web Development",         issueDate: "20-09-2023" },
];

export default function InstitutionDashboard() {
  const [q, setQ] = useState("");

  // Simple client-side search over name/title/nationalId
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return MOCK;
    return MOCK.filter(r =>
      r.applicantName.toLowerCase().includes(s) ||
      r.title.toLowerCase().includes(s) ||
      r.nationalId.includes(s)
    );
  }, [q]);

  return (
    <section className="auth-hero">
      <div className="auth-wrap">
        {/* Big white card like your screenshot */}
        <div className="auth-card">
          <h1 className="text-2xl font-bold mb-6">Home</h1>

          {/* Search bar */}
          <div className="mb-6">
            <label htmlFor="search" className="sr-only">Search</label>
            <input
              id="search"
              placeholder="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Applicant name</th>
                    <th className="px-4 py-3 text-left font-semibold">Certificate Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                    <th className="px-4 py-3 text-left font-semibold">National ID</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.certificateId} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">{r.applicantName}</td>
                      <td className="px-4 py-3">{r.title}</td>
                      <td className="px-4 py-3">{r.issueDate}</td>
                      <td className="px-4 py-3">{r.nationalId}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          {/* ⤵️ opens the shared details page */}
                          <Link
                            to={`/employer/certificates/${encodeURIComponent(r.certificateId)}`}
                            state={{ from: "/institution/dashboard" }} 
                            className="btn btn-outline"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        No certificates found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
