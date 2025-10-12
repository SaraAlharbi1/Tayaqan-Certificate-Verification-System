// src/pages/institution/IssuedCertificates.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

/* ----------------------------- Types ----------------------------- */
type Row = {
  certificateId: string;
  applicantName: string;
  nationalId: string;
  title: string;
  issueDate: string;
  serialNumber: string;
  status: "ACTIVE" | "REVOKED" | string;
};

type BackendCert = {
  id: string | number;
  display_label?: string;
  issued_on?: string;
  serial_number?: string;
  status?: string; // backend raw status (e.g. ISSUED_ONCHAIN or REVOKED)
  applicant?: {
    id: string | number;
    name?: string;
    national_id?: string;
  };
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/* ----------------------------- Constants ----------------------------- */
const ACTIVE_BACKEND_STATUSES = ["ISSUED_ONCHAIN"];

/* ----------------------------- Component ----------------------------- */
export default function IssuedCertificates() {
  const [q, setQ] = useState("");

  // filters
  const [status, setStatus] = useState<"" | "ACTIVE" | "REVOKED">("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  // revoke confirm modal
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* ----------------------------- Fetch list ----------------------------- */
  const fetchPage = async (pageNum: number) => {
    setLoading(true);
    setErr(null);

    const params = new URLSearchParams();
    params.set("page", String(pageNum));
    if (q.trim()) params.set("search", q.trim());

    if (status === "REVOKED") {
      params.set("status", "REVOKED");
    } else if (status === "ACTIVE") {
      params.set("status__in", ACTIVE_BACKEND_STATUSES.join(","));
    }
    if (fromDate) params.set("issued_on__gte", fromDate);
    if (toDate) params.set("issued_on__lte", toDate);

    const res = await api<Paginated<BackendCert>>(
      `/certificates/?${params.toString()}`,
      { method: "GET" }
    );

    const list = res.results ?? [];
    const mapped: Row[] = list.map((d) => {
      const revoked = String(d.status || "").toUpperCase() === "REVOKED";
      return {
        certificateId: String(d.id),
        applicantName: d.applicant?.name ?? "",
        nationalId: d.applicant?.national_id ?? "—",
        title: d.display_label ?? "",
        issueDate: d.issued_on ? new Date(d.issued_on).toLocaleDateString() : "",
        serialNumber: d.serial_number ?? "",
        status: revoked ? "REVOKED" : "ACTIVE",
      };
    });

    setRows(mapped);
    setTotal(res.count ?? mapped.length);
    setCanNext(Boolean(res.next));
    setCanPrev(Boolean(res.previous));
    setLoading(false);
  };

  /* ----------------------------- Lifecycle ----------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchPage(page);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Failed to load certificates.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, q, status, fromDate, toDate]);

  const filtered = useMemo(() => rows, [rows]);

  /* ----------------------------- Revoke ----------------------------- */
  const askRevoke = (id: string) => setConfirmId(id);

  const doRevoke = async () => {
    if (!confirmId) return;
    try {
      setBusy(true);
      await api(`/certificates/${encodeURIComponent(confirmId)}/revoke/`, {
        method: "POST",
      });
      await fetchPage(page);
    } catch (e: any) {
      alert(e?.userMessage || e?.message || "Revoke failed. Please try again.");
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  };

  /* ----------------------------- UI ----------------------------- */
  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Issued{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">
            Browse certificates issued by your institution
          </p>
        </div>

        {/* Card */}
        <div className="auth-card mt-0">
          {/* Top bar: search + total badge */}
          <div className="mb-4 flex items-center gap-3">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input
              id="search"
              placeholder="Search by title, serial, applicant…"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              className="flex-1 h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
            />

            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  loading ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              {loading ? "Loading…" : `${total} total`}
            </span>
          </div>

          {/* Filters row */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Status */}
            <div>
              <label className="sr-only" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as "" | "ACTIVE" | "REVOKED");
                }}
                className="w-full h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="REVOKED">REVOKED</option>
              </select>
            </div>

            {/* From date */}
            <div>
              <label className="sr-only" htmlFor="fromDate">
                From
              </label>
              <input
                id="fromDate"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setPage(1);
                  setFromDate(e.target.value);
                }}
                className="w-full h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
              />
            </div>

            {/* To date */}
            <div>
              <label className="sr-only" htmlFor="toDate">
                To
              </label>
              <input
                id="toDate"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setPage(1);
                  setToDate(e.target.value);
                }}
                className="w-full h-12 rounded-2xl bg-gray-50 px-4 outline-none ring-0 focus:ring-2 focus:ring-brand-600/30"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Applicant</th>
                    <th className="px-4 py-3 text-left font-semibold">Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Serial Number</th>
                    <th className="px-4 py-3 text-left font-semibold">National ID</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                        Loading…
                      </td>
                    </tr>
                  )}

                  {!loading && err && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-red-600">
                        {err}
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    !err &&
                    filtered.map((r) => {
                      const revoked = (r.status || "").toUpperCase() === "REVOKED";
                      const rowBusy = busy && confirmId === r.certificateId;
                      return (
                        <tr key={r.certificateId} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3">{r.applicantName}</td>
                          <td className="px-4 py-3">{r.title}</td>
                          <td className="px-4 py-3">{r.issueDate}</td>
                          <td className="px-4 py-3">{r.serialNumber}</td>
                          <td className="px-4 py-3">{r.nationalId}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                                revoked
                                  ? "bg-red-50 text-red-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  revoked ? "bg-red-500" : "bg-emerald-500"
                                }`}
                              />
                              {revoked ? "REVOKED" : "ACTIVE"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Link
                                to={`/institution/certificates/${encodeURIComponent(
                                  r.certificateId
                                )}`}
                                state={{ from: "/institution/certificates" }}
                                className="btn btn-outline"
                              >
                                View
                              </Link>
                              <button
                                className="btn btn-ghost"
                                onClick={() => askRevoke(r.certificateId)}
                                disabled={revoked || rowBusy}
                                title={
                                  revoked
                                    ? "Already revoked"
                                    : "Revoke this certificate"
                                }
                              >
                                {rowBusy ? "Revoking…" : "Revoke"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && !err && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                        <div className="mb-3">No certificates found.</div>
                        <Link to="/institution/upload" className="btn btn-primary">
                          Upload a Certificate
                        </Link>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination (no Math.max) */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">Page {page}</div>
            <div className="flex gap-2">
              <button
                className="btn btn-outline"
                onClick={() => setPage((p) => (p > 1 ? p - 1 : 1))}
                disabled={!canPrev || loading}
              >
                Previous
              </button>
              <button
                className="btn btn-outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={loading || !canNext}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm revoke modal */}
      <ConfirmDialog
        open={!!confirmId}
        title="Revoke certificate"
        message="This action cannot be undone."
        confirmText="Revoke"
        cancelText="Cancel"
        busy={busy}
        onConfirm={doRevoke}
        onCancel={() => setConfirmId(null)}
      />
    </section>
  );
}
