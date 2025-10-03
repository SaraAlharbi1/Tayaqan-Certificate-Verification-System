// src/Pages/EmployerRole/AccessRequests.tsx
import { Link, useNavigate } from "react-router-dom";

type Status = "Approved" | "Pending";
type Row = {
  requestId: string;
  applicantId: string;
  applicantName: string;
  applicantEmail?: string;
  createdAt: string;
  status: Status;
};

const SEED: Row[] = [
  {
    requestId: "req_01",
    applicantId: "12345611",
    applicantName: "Rawan",
    applicantEmail: "rawan@example.com",
    createdAt: "2025-09-20T10:12:00Z",
    status: "Approved",
  },
  {
    requestId: "req_02",
    applicantId: "12345611",
    applicantName: "Rawan",
    applicantEmail: "r.alrawan@example.com",
    createdAt: "2025-09-22T08:00:00Z",
    status: "Pending",
  },
  {
    requestId: "req_04",
    applicantId: "12345665",
    applicantName: "Njood",
    applicantEmail: "njood@example.com",
    createdAt: "2025-09-26T09:30:00Z",
    status: "Approved",
  },
];

function StatusBadge({ status }: { status: Status }) {
  const p = {
    Approved: {
      bg: "bg-emerald-100",
      dot: "bg-emerald-500",
      text: "text-emerald-700",
    },
    Pending: {
      bg: "bg-rose-100",
      dot: "bg-rose-500",
      text: "text-rose-700",
    },
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${p[status].bg} ${p[status].text}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${p[status].dot}`} />
      {status}
    </span>
  );
}

export default function AccessRequests() {
  const navigate = useNavigate();

  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-24">
      {/* Page header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Access{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Requests
          </span>
        </h1>
        <Link to="/employer/access/new" className="btn btn-primary">
          + New Request
        </Link>
      </div>

      {/* Requests table */}
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Applicant</th>
                <th className="px-4 py-3 text-left font-semibold">Applicant ID</th>
                <th className="px-4 py-3 text-left font-semibold">Created</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SEED.map((r) => {
                const isApproved = r.status === "Approved";
                return (
                  <tr key={r.requestId} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.applicantName}</div>
                      {r.applicantEmail && (
                        <div className="text-xs text-gray-500">{r.applicantEmail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.applicantId}</td>
                    <td className="px-4 py-3">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          className={`btn ${isApproved ? "btn-secondary" : "btn-disabled"}`}
                          disabled={!isApproved}
                          onClick={() =>
                            isApproved &&
                            navigate(`/employer/applicants/${r.applicantId}/shared`)
                          }
                          title={
                            isApproved
                              ? "Open shared certificates"
                              : "Waiting for applicant approval"
                          }
                        >
                          View Certificates
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {SEED.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-gray-500 text-sm"
                  >
                    No access requests yet.
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
