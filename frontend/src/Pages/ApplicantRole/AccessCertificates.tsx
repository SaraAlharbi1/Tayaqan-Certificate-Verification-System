// src/Pages/ApplicantRole/AccessCertificates.tsx
import { useMemo, useState, useEffect } from "react";

type Certificate = {
  id: number;
  title: string;
  issuer: string;
  issueDate: string; // YYYY-MM-DD
  serial: string;
};

export default function AccessCertificates() {
  // Mock data
  const [certificates] = useState<Certificate[]>([
    { id: 1, title: "Blockchain Fundamentals", issuer: "Univ. of Technology", issueDate: "2024-06-15", serial: "1234567" },
    { id: 2, title: "Data Science Essentials", issuer: "Univ. of Technology", issueDate: "2023-09-20", serial: "2468100" },
    { id: 3, title: "Machine Learning", issuer: "Online institute", issueDate: "2023-09-20", serial: "6001003" },
    { id: 4, title: "Web Development", issuer: "Online institute", issueDate: "2023-09-20", serial: "5436900" },
  ]);

  // Search
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!q) return certificates;
    return certificates.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q) ||
        c.serial.toLowerCase().includes(q)
    );
  }, [q, certificates]);

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const anySelected = selected.size > 0;

  const handleApprove = () => {
    alert(`Approved ${selected.size} certificate(s).`);
    setSelected(new Set());
  };
  const handleDecline = () => {
    alert(`Declined ${selected.size} certificate(s).`);
    setSelected(new Set());
  };

  return (
    <section className="pt-2 md:pt-3 -mt-6 md:-mt-10 pb-10">
      <div className="mx-auto max-w-6xl px-6">
        {/* Page title (same style as other pages) */}
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
          Share{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Access
          </span>
        </h1>
        <p className="text-gray-600 mb-4">
          <span className="text-indigo-600 font-semibold">Select</span> certificate(s) to share
        </p>

        {/* Card with search header */}
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="p-4 border-b border-gray-100">
            <label htmlFor="cert-search" className="sr-only">
              Search certificates
            </label>
            <div className="relative">
              <input
                id="cert-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, issuer, or serial"
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
              Showing {filtered.length} of {certificates.length}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Certificate Title</th>
                  <th className="px-4 py-3 text-left font-semibold">Issuer</th>
                  <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Serial Number</th>
                  <th className="px-4 py-3 text-center font-semibold">Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">{c.title}</td>
                    <td className="px-4 py-3">{c.issuer}</td>
                    <td className="px-4 py-3">{new Date(c.issueDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{c.serial}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-indigo-600"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      No certificates found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Actions footer */}
          <div className="p-4 border-t border-gray-100 flex justify-center gap-3">
            <button
              type="button"
              disabled={!anySelected}
              onClick={handleApprove}
              className={`btn btn-primary min-w-28 ${!anySelected ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={!anySelected}
              onClick={handleDecline}
              className={`btn btn-outline min-w-28 ${!anySelected ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Decline
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
