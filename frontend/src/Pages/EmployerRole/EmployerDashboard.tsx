
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

// Row type for table data
type Row = { name: string; id: string; status: "Approved" | "Pending" };

// Small component to render status badge (Approved / Pending)
function StatusBadge({ status }: { status: Row["status"] }) {
  const palette: Record<Row["status"], { bg: string; dot: string; text: string }> = {
    Approved: { bg: "bg-emerald-100", dot: "bg-emerald-500", text: "text-emerald-700" },
    Pending: { bg: "bg-rose-100", dot: "bg-rose-500", text: "text-rose-700" },
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm 
        ${palette[status].bg} ${palette[status].text}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full ${palette[status].dot}`} />
      {status}
    </span>
  );
}

// Dummy data for table rows
const seed: Row[] = [
  { name: "Rawan", id: "12345611", status: "Approved" },
  { name: "Fatima", id: "12345689", status: "Pending" },
  { name: "Sara", id: "12345621", status: "Pending" },
  { name: "Njood", id: "12345665", status: "Approved" },
  { name: "Rafa", id: "12345776", status: "Approved" },
  { name: "RenaD", id: "12345665", status: "Pending" },
  { name: "Ahmed", id: "12345611", status: "Approved" },
  { name: "Mohammed", id: "12345688", status: "Approved" },
  { name: "Joud", id: "12345599", status: "Pending" },
  { name: "Layan", id: "12345690", status: "Pending" },
  { name: "Samar", id: "12345664", status: "Pending" },
];

export default function AccessRequests() {
  const navigate = useNavigate(); 

  return (
  // align with navbar container & tuck closer under the wave
  <section className="relative mx-auto max-w-6xl px-6 pt-2 md:pt-3 -mt-6 md:-mt-10 pb-20">
    {/* Page title above the card */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <h1 className="text-3xl font-extrabold tracking-tight">Access Requests</h1>
      <Link to="/employer/access/new" className="btn btn-primary">
        Create Access Request
      </Link>
    </div>

    {/* Card */}
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Applicant Name</th>
              <th className="px-4 py-3 text-left font-semibold">ID</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {seed.map((r) => {
              const isApproved = r.status === "Approved";
              return (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50/60 ${
                    isApproved ? "cursor-pointer" : "cursor-default"
                  }`}
                  onClick={() => {
                    if (isApproved) navigate(`/employer/applicants/${r.id}/shared`);
                  }}
                  tabIndex={isApproved ? 0 : -1}
                  onKeyDown={(e) => {
                    if (isApproved && (e.key === "Enter" || e.key === " ")) {
                      navigate(`/employer/applicants/${r.id}/shared`);
                    }
                  }}
                >
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.id}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

}