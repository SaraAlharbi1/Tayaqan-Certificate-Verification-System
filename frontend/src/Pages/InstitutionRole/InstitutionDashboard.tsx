// src/pages/institution/InstitutionDashboard.tsx
// ----------------------------------------------------------------------------
// InstitutionDashboard
// - Lists issued certificates for an institution.
// - Title is outside the white card and spacing is tightened toward the navbar.
// - Simple client-side search filters by applicant name, certificate title, or ID.
// - Replace MOCK data with an API call when backend is ready.
// ----------------------------------------------------------------------------

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

/** Row shape for table items (align with backend DTO when available). */
type Row = {
  certificateId: string; // unique; used for routing to details
  applicantName: string;
  nationalId: string;
  title: string;
  issueDate: string;     // format: DD-MM-YYYY (consider normalizing later)
};

/**
 * Temporary mock data
 * TODO: swap with GET /institution/certificates (or similar) and handle loading/error states.
 */
const MOCK: Row[] = [
  { certificateId: "cert-1001", applicantName: "Rawan Mohammed", nationalId: "1234567", title: "Blockchain Technology", issueDate: "15-06-2024" },
  { certificateId: "cert-1002", applicantName: "Fatima Rajh",    nationalId: "2468100", title: "Data Science Essentials", issueDate: "20-09-2023" },
  { certificateId: "cert-1003", applicantName: "Sara Sultan",    nationalId: "6001003", title: "Learning",                issueDate: "20-09-2023" },
  { certificateId: "cert-1004", applicantName: "Njood Alharbi",  nationalId: "5436900", title: "Web Development",         issueDate: "20-09-2023" },
];

export default function InstitutionDashboard() {
  /** Search query state (bound to the search input). */
  const [q, setQ] = useState("");

  /**
   * Filter rows on the client.
   * - Lowercases name/title for case-insensitive match.
   * - National ID check is kept as string includes().
   * - For large datasets, move search to the API (query params) and paginate.
   */
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
    /**
     * Section spacing:
     * - We deliberately avoid the global `.auth-hero` large top padding here.
     * - `pt-6 md:pt-8` pulls the content closer to the navbar as requested.
     * - If your project requires consistent wrappers, consider a prop-driven layout.
     */
    <section className="pt-2 md:pt-3 -mt-6 md:-mt-10 pb-10">
      <div className="auth-wrap">
        {/**
         * Page title OUTSIDE the card so it visually sits above the card.
         * `mb-4` keeps the title close to the table card.
         */}
        <h1 className="text-3xl font-extrabold tracking-tight mb-4">Home</h1>

        {/**
         * White card that contains search and the table.
         * `mt-0` ensures no extra gap between title and card.
         */}
        <div className="auth-card mt-0">
          {/* Search bar (a11y: label is visually hidden but screen-reader friendly) */}
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

          {/* Responsive table container with subtle border/shadow */}
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
                          {/*
                            Details route:
                            - Using employer path per current app structure.
                            - `state.from` can help the details page build a Back link.
                            - Consider switching to an institution-specific details route when ready.
                          */}
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

                  {/* Empty-state row (shown when search returns no matches) */}
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
