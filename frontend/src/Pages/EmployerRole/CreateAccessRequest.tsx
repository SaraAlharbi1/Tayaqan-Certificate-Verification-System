// src/Pages/EmployerRole/CreateAccessRequest.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Minimal applicant type for demo purposes.
 * Replace with your API response type when you wire the backend.
 */
type Applicant = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

// Demo dataset (mock). You can replace this with an API call.
const MOCK_APPLICANTS: Applicant[] = [
  {
    id: "12345111",
    name: "Rawan Mohammed Alshehri",
    email: "rbinalabdullah@stg.kau.edu.sa",
    phone: "0533750087",
  },
  // add more…
];

export default function CreateAccessRequest() {
  const navigate = useNavigate();

  // Local state: search query and submission state
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Resolve the applicant by exact ID match (update logic as needed)
  const applicant = useMemo(
    () => MOCK_APPLICANTS.find((a) => a.id === query.trim()),
    [query]
  );

  // Simulated submit handler
  const handleSubmit = async () => {
    if (!applicant) return;
    try {
      setSubmitting(true);

      // TODO: Call your API, e.g.:
      // await api.post('/employer/access-requests', { applicantId: applicant.id, reason: ... })

      // Simple UX feedback for demo
      alert(`Access request sent for ID ${applicant.id}`);
      navigate("/signup/employer"); // back to list page (adjust route if needed)
    } catch (err) {
      alert("Failed to send request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl px-6 pt-10 pb-24">
      {/* Page title */}
      <h1 className="text-2xl font-bold mb-6">Certificate Access Request</h1>

      {/* Search input (by Applicant ID) */}
      <div className="mb-6">
        <label htmlFor="search" className="sr-only">
          Search by Applicant ID
        </label>
        <div className="relative">
          <input
            id="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Applicant ID…"
            className="w-full h-12 rounded-xl border border-black/10 px-4 pr-10 outline-none focus:ring-2 focus:ring-brand-500"
          />
          
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Type an exact ID (e.g., <code>12345111</code>) to load applicant info.
        </p>
      </div>

      {/* Applicant card */}
      {applicant && (
        <div className="rounded-xl border border-black/10 bg-white shadow-sm p-6 md:p-8 mb-6">
          <h2 className="font-semibold text-brand-700 mb-4">Applicant info</h2>

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
      )}

      {/* Submit button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!applicant || submitting}
          className={`btn btn-primary ${!applicant || submitting ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {submitting ? "Sending..." : "Send Request Access"}
        </button>
      </div>
    </section>
  );
}
