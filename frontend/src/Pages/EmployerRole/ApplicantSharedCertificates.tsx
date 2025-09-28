// src/Pages/EmployerRole/ApplicantSharedCertificates.tsx
import { useMemo } from "react";
import { Link, useParams, useLocation } from "react-router-dom";

type Certificate = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  serial: string;
};

const MOCK_DB: Record<string, Certificate[]> = {
  "12345611": [
    { id: "ml-basics-001", title: "AI & Machine Learning (Basics)", issuer: "IBM Skills Academy", issueDate: "19-06-2024", serial: "IT-2406-00173" },
    { id: "cyber-001", title: "Cybersecurity Fundamentals", issuer: "Cisco Academy", issueDate: "20-09-2023", serial: "CS-2309-00450" },
  ],
};

export default function ApplicantSharedCertificates() {
  const { applicantId = "" } = useParams<{ applicantId: string }>();
  const location = useLocation();

  const items = useMemo<Certificate[]>(
    () => MOCK_DB[applicantId] ?? [],
    [applicantId]
  );

  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-24">
      <h1 className="text-2xl font-bold mb-6">Shared Certificates</h1>

      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Certificate Title</th>
                <th className="px-4 py-3 text-left font-semibold">Issuer</th>
                <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                <th className="px-4 py-3 text-left font-semibold">Serial Number</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">{c.title}</td>
                  <td className="px-4 py-3">{c.issuer}</td>
                  <td className="px-4 py-3">{c.issueDate}</td>
                  <td className="px-4 py-3">{c.serial}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <Link
                        to={`/employer/certificates/${c.id}`}
                        state={{ from: location.pathname }}
                        className="btn btn-secondary"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                    No certificates shared with this applicant ID.
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
