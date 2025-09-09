// src/Pages/ApplicantRole/AccessCertificates.tsx
import { useState } from "react";

export default function AccessCertificates() {
  const [search, setSearch] = useState("");

  const certificates = [
    {
      id: 1,
      title: "Blockchain Fundamentals",
      issuer: "Univ. of Technology",
      issueDate: "2024-06-15",
      serial: "1234567",
    },
    {
      id: 2,
      title: "Data Science Essentials",
      issuer: "Univ. of Technology",
      issueDate: "2023-09-20",
      serial: "2468100",
    },
    {
      id: 3,
      title: "Machine Learning",
      issuer: "Online institute",
      issueDate: "2023-09-20",
      serial: "6001003",
    },
    {
      id: 4,
      title: "Web Development",
      issuer: "Online institute",
      issueDate: "2023-09-20",
      serial: "5436900",
    },
  ];

  const filtered = certificates.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">Share Access</h1>
      <p className="text-lg mb-4">
        <span className="text-indigo-600 font-semibold">Select</span> certificate
      </p>

      {/* Search input */}
      <input
        type="text"
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-indigo-500"
      />

      {/* Certificates table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="w-full table-auto">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">
                Certificate Title
              </th>
              <th className="px-6 py-3 text-left font-semibold">Issuer</th>
              <th className="px-6 py-3 text-left font-semibold">Issue Date</th>
              <th className="px-6 py-3 text-left font-semibold">
                Serial Number
              </th>
              <th className="px-6 py-3 text-left font-semibold">Select</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-6 py-3">{c.title}</td>
                <td className="px-6 py-3">{c.issuer}</td>
                <td className="px-6 py-3">{c.issueDate}</td>
                <td className="px-6 py-3">{c.serial}</td>
                <td className="px-6 py-3">
                  <input type="checkbox" className="h-4 w-4 text-indigo-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center mt-8">
        <div className="flex gap-80">
          <button className="px-8 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
            Approve
          </button>
          <button className="px-8 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700">
            Decline
          </button>
        </div>
      </div>
    </section>
  );
}
