// src/Pages/EmployerRole/CreateAccessRequest.tsx
import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

type Applicant = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

const MOCK_APPLICANTS: Applicant[] = [
  {
    id: "12345111",
    name: "Rawan Mohammed Alshehri",
    email: "rbinalabdullah@stg.kau.edu.sa",
    phone: "0533750087",
  },
  // add more as needed
];

export default function CreateAccessRequest() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const trimmed = query.trim();
  const applicant = useMemo(
    () => MOCK_APPLICANTS.find((a) => a.id === trimmed) || null,
    [trimmed]
  );

  const handleSubmit = async () => {
    if (!applicant) return;
    try {
      setSubmitting(true);
      // TODO: POST to your API:
      // await api.post('/employer/access-requests', { applicantId: applicant.id })
      alert(`Access request sent for ID ${applicant.id}`);
      navigate("/employer/access"); // correct route back to list
    } catch (err) {
      alert("Failed to send request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-24">
      {/* Title (gradient like other pages) */}
      <div className="mb-2 flex items-center justify-between gap-4">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Create{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Access Request
          </span>
        </h1>
        <Link to="/employer/access" className="text-indigo-600 hover:underline">
          ← Back to Access Requests
        </Link>
      </div>
      <p className="text-gray-600 mb-8">
        Enter the applicant’s national ID to request access to their certificates.
      </p>

      {/* Search by Applicant ID */}
      <div className="mb-6">
        <label htmlFor="search" className="sr-only">
          Search by Applicant ID
        </label>
        <div className="relative">
          <input
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            placeholder="Search by Applicant ID…"
            className="w-full h-12 rounded-xl border border-black/10 px-4 pr-10 outline-none focus:ring-2 focus:ring-brand-500"
          />
          {/* optional icon slot on the right if you add one later */}
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Type an exact ID (e.g., <code>12345111</code>) to load applicant info.
        </p>
      </div>

      {/* Applicant card */}
      {applicant ? (
        <div className="rounded-xl border border-black/10 bg-white shadow-sm p-6 md:p-8 mb-6">
          <h2 className="font-semibold text-brand-700 mb-4">Applicant Info</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-3">
            <dt className="text-gray-500">Name</dt>
            <dd className="sm:col-span-2">{applicant.name}</dd>

            <dt className="text-gray-500">ID</dt>
            <dd className="sm:col-span-2">{applicant.id}</dd>

            <dt className="text-gray-500">Email</dt>
            <dd className="sm:col-span-2">{applicant.email}</dd>

            <dt className="text-gray-500">Phone number</dt>
            <dd className="sm:col-span-2">{applicant.phone}</dd>
          </dl>
        </div>
      ) : trimmed ? (
        <div className="rounded-xl border border-black/10 bg-white shadow-sm p-5 mb-6 text-sm text-gray-600">
          No applicant found for ID <span className="font-mono">{trimmed}</span>.
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link to="/employer/access" className="btn btn-ghost">
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!applicant || submitting}
          className={`btn btn-primary ${
            !applicant || submitting ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          {submitting ? "Sending…" : "Send Request Access"}
        </button>
      </div>
    </section>
  );
}
