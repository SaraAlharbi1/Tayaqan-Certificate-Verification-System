// src/Pages/ApplicantRole/CertificatesPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Certificate = {
  id: number;
  title: string;
  issuer: string;
  issueDate: string; // YYYY-MM-DD
  serial: string;
};

export default function CertificatesPage() {
  const [certificates] = useState<Certificate[]>([
    { id: 1, title: "Blockchain Fundamentals", issuer: "Univ. of Technology", issueDate: "2024-06-15", serial: "1234567" },
    { id: 2, title: "Data Science Essentials", issuer: "Univ. of Technology", issueDate: "2023-09-20", serial: "2468100" },
    { id: 3, title: "Machine Learning", issuer: "Online institute", issueDate: "2023-09-20", serial: "6001003" },
    { id: 4, title: "Web Development", issuer: "Online institute", issueDate: "2023-09-29", serial: "5436900" },
  ]);

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().toLowerCase()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    if (!q) return certificates;
    return certificates.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.issuer.toLowerCase().includes(q) ||
      c.serial.toLowerCase().includes(q)
    );
  }, [q, certificates]);

  return (
    // شيلنا الـpy الكثيرة وخلينا pt-4 فقط
    <section className="px-6 pt-4 pb-8">
      <div className="mx-auto max-w-6xl">
        {/* العنوان */}
        <h1 className="text-3xl md:text-4xl font-bold text-blue-900 mb-6">
          My Certificates
        </h1>

        {/* شريط البحث */}
        <div className="mb-4 w-full">
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
          <p className="mt-2 text-sm text-slate-500">
            Showing {filtered.length} of {certificates.length}
          </p>
        </div>

        {/* الجدول */}
        <div className="overflow-x-auto rounded-2xl bg-white shadow">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left text-sm font-semibold text-gray-600">
                <th className="px-6 py-3">Certificate Title</th>
                <th className="px-6 py-3">Issuer</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Serial Number</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-6 py-4">{c.title}</td>
                  <td className="px-6 py-4">{c.issuer}</td>
                  <td className="px-6 py-4">
                    {new Date(c.issueDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">{c.serial}</td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/applicant/certificates/${c.id}`}
                      className="inline-block px-4 py-1 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No certificates match your search.
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
