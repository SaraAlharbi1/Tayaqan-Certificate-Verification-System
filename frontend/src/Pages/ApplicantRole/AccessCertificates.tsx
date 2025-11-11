// src/Pages/ApplicantRole/AccessCertificates.tsx
import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import ConfirmDialog from "@/components/ConfirmDialog";

/* ----------------------------- Types ----------------------------- */
type Certificate = {
  id: number;
  title?: string;
  issuer?: string;
  issueDate?: string;
  serial?: string;
  fileHash?: string;
  status?: "ACTIVE" | "REVOKED" | "INVALID" | "CHECKING";
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type AccessReqDetail = {
  id: number;
  status: "PENDING" | "APPROVED" | "DECLINED";
  created_at: string;
  decided_at?: string | null;
  company?: string;
};

/* ----------------------------- Helpers ----------------------------- */
const normHash = (h?: string) =>
  !h ? "" : (h.startsWith("0x") ? h : "0x" + h).toLowerCase();

/* ----------------------------- Main ----------------------------- */
export default function AccessCertificates() {
  const { requestId } = useParams<{ requestId: string }>();
  const id = requestId;
  const navigate = useNavigate();

  const [req, setReq] = useState<AccessReqDetail | null>(null);
  const [certs, setCerts] = useState<Paginated<Certificate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [verifying, setVerifying] = useState(false); // kept for UI compatibility

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch request + candidate certificates (server already includes chain status)
  useEffect(() => {
    if (!id) return;
    let cancel = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const [reqData, certsRaw] = await Promise.all([
          api<AccessReqDetail>(`/my/requests/${id}/`),
          api<Paginated<any>>(`/my/requests/${id}/candidate_certificates/`),
        ]);

        // Map to UI rows; TRUST server status, do NOT re-verify client-side
        const mapped: Certificate[] = (certsRaw.results ?? []).map((r: any) => ({
          id: r.id,
          title: r.title ?? r.display_label ?? `Certificate #${r.id}`,
          issuer: r.issuerName ?? r.institution_name ?? r.issuer ?? "—",
          issueDate: r.issueDate ?? r.issued_on,
          serial: r.serial ?? r.serial_number,
          fileHash: r.file_hash ?? r.fileHash,
          status: (r.status as Certificate["status"]) ?? "INVALID",
        }));

        if (cancel) return;

        setReq(reqData);
        setCerts({ ...certsRaw, results: mapped });
        setLoading(false);

        // Removed: verifyStatuses(mapped) — backend already returns status
      } catch (e: any) {
        if (!cancel) {
          setError(e?.userMessage || e?.message || "Failed to load request details.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [id]);

  // Verify on-chain (batch) — retained but unused after change
  const verifyStatuses = async (rows: Certificate[]) => {
    try {
      setVerifying(true);
      const hashes = Array.from(
        new Set(rows.map((r) => normHash(r.fileHash)).filter(Boolean))
      );
      if (!hashes.length) {
        setCerts((prev) =>
          prev
            ? {
                ...prev,
                results: prev.results.map((r) => ({ ...r, status: "INVALID" })),
              }
            : prev
        );
        return;
      }

      const arr = await api<any[]>(
        `/my/certificates/verify-batch/`,
        { method: "POST", body: JSON.stringify({ file_hashes: hashes }) }
      );

      const map = new Map<string, { exists: boolean; revoked: boolean }>();
      for (const o of arr || []) {
        map.set(normHash(o.fileHash), { exists: !!o.exists, revoked: !!o.revoked });
      }

      setCerts((prev) =>
        !prev
          ? prev
          : {
              ...prev,
              results: prev.results.map((r) => {
                const st = map.get(normHash(r.fileHash));
                if (!st) return { ...r, status: "INVALID" };
                if (!st.exists) return { ...r, status: "INVALID" };
                if (st.revoked) return { ...r, status: "REVOKED" };
                return { ...r, status: "ACTIVE" };
              }),
            }
      );
    } catch (e) {
      console.error("verify-batch failed", e);
    } finally {
      setVerifying(false);
    }
  };

  // Client filtering
  const filtered = useMemo(() => {
    const items = certs?.results ?? [];
    if (!q) return items;
    return items.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.issuer || "").toLowerCase().includes(q) ||
        (c.serial || "").toLowerCase().includes(q)
    );
  }, [q, certs]);

  // Selection
  const isPending = req?.status === "PENDING";
  const toggle = (cid: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(cid) ? n.delete(cid) : n.add(cid);
      return n;
    });

  const selectableIds = filtered
    .filter((c) => c.status === "ACTIVE")
    .map((c) => c.id);

  const anySelected = selected.size > 0;
  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selected.has(id));

  const selectAll = () => setSelected(new Set(selectableIds));
  const clearSelection = () => setSelected(new Set());

  // Approve
  const approve = async () => {
    if (!id || !anySelected) return;
    setError("");
    setSubmitting(true);
    try {
      await api(`/my/requests/${id}/approve/`, {
        method: "POST",
        body: JSON.stringify({ certificate_ids: Array.from(selected) }),
      });
      navigate("/applicant/requests", {
        state: {
          message: `Successfully approved! ${selected.size} certificate(s) shared with ${req?.company || "the employer"}.`,
        },
      });
    } catch (e: any) {
      setError(e?.userMessage || e?.message || "Failed to approve request.");
      setSubmitting(false);
    }
  };

  // Decline (with confirm)
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const doDecline = async () => {
    if (!id) return;
    setError("");
    setSubmitting(true);
    try {
      await api(`/my/requests/${id}/decline/`, { method: "POST" });
      navigate("/applicant/requests", {
        state: { message: `Request from ${req?.company || "the employer"} has been declined.` },
      });
    } catch (e: any) {
      setError(e?.userMessage || e?.message || "Failed to decline request.");
      setSubmitting(false);
      setShowDeclineConfirm(false);
    }
  };

  /* ----------------------------- UI ----------------------------- */
  if (loading) {
    return (
      <section className="pt-0 pb-6">
        <div className="auth-wrap">
          <div className="auth-card flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Loading request details...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error && !req) {
    return (
      <section className="pt-0 pb-6">
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-red-200 bg-red-50">
              <svg className="w-6 h-6 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold text-red-900">Error Loading Request</p>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
            <button onClick={() => navigate("/applicant/requests")} className="mt-4 btn btn-primary">
              ← Back to Requests
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Share <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Certificates</span>
            </h1>
            <p className="mt-1 text-gray-500">
              Request from <span className="font-semibold text-gray-900">{req?.company || "Unknown"}</span>
              <span
                className={`ml-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  req?.status === "APPROVED"
                    ? "bg-emerald-50 text-emerald-700"
                    : req?.status === "DECLINED"
                    ? "bg-red-50 text-red-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    req?.status === "APPROVED" ? "bg-emerald-500" : req?.status === "DECLINED" ? "bg-red-500" : "bg-amber-500"
                  }`}
                />
                {req?.status || "PENDING"}
              </span>
            </p>
          </div>
          <button onClick={() => navigate("/applicant/requests")} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
            ← Back
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, issuer, or serial..."
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none ring-0 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center gap-3">
                {selected.size > 0 && (
                  <button onClick={() => setSelected(new Set())} className="text-sm font-medium text-gray-700 hover:text-gray-900">
                    Clear
                  </button>
                )}
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm">
                  <span className={`inline-block h-2 w-2 rounded-full ${verifying ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                  <span className="font-semibold text-gray-700">{(certs?.results ?? []).length}</span>
                  <span className="text-gray-600">total</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-indigo-600 cursor-pointer"
                      checked={allSelected}
                      onChange={() => (allSelected ? clearSelection() : selectAll())}
                      disabled={!isPending || !selectableIds.length}
                      aria-label="Select all certificates"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Title</th>
                  <th className="px-4 py-3 text-left font-semibold">Issuer</th>
                  <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Serial</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(filtered ?? []).map((c) => {
                  const isSelected = selected.has(c.id);
                  const disabled =
                    !isPending || !(c.status === "ACTIVE") || verifying;

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${isSelected ? "bg-indigo-50/50" : "hover:bg-gray-50/60"} ${
                        disabled && "opacity-60"
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          checked={isSelected}
                          onChange={() => toggle(c.id)}
                          disabled={disabled}
                          aria-label={`Select ${c.title || "certificate"}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.title || `Certificate #${c.id}`}</td>
                      <td className="px-4 py-3 text-gray-600">{c.issuer || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {c.issueDate
                          ? new Date(c.issueDate).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {c.serial || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "CHECKING" && (
                          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-gray-50 text-gray-600">
                            <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Checking...
                          </span>
                        )}
                        {c.status === "ACTIVE" && (
                          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            ACTIVE
                          </span>
                        )}
                        {c.status === "REVOKED" && (
                          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-red-50 text-red-700">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            REVOKED
                          </span>
                        )}
                        {c.status === "INVALID" && (
                          <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold bg-amber-50 text-amber-700">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            INVALID
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="text-gray-500 font-medium">No certificates found</p>
                          <p className="text-sm text-gray-400 mt-1">
                            {q ? "Try adjusting your search" : "You don't have any certificates to share"}
                          </p>
                        </div>
                        {q && (
                          <button onClick={() => setSearch("")} className="mt-2 btn btn-outline text-sm">
                            Clear Search
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer actions */}
          {isPending ? (
            <div className="bg-gray-50 px-5 py-4 border-top border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                {anySelected ? (
                  <span>
                    <span className="font-semibold text-gray-900">{selected.size}</span> certificate
                    {selected.size !== 1 ? "s" : ""} selected
                  </span>
                ) : (
                  <span>Select ACTIVE certificates to share with {req?.company || "the employer"}</span>
                )}
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowDeclineConfirm(true)}
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg disabled:opacity-50"
                >
                  Decline Request
                </button>
                <button
                  type="button"
                  disabled={!anySelected || submitting}
                  onClick={approve}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve & Share
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 px-5 py-4 border-t-2 border-amber-200">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-amber-800">
                  This request has already been {req?.status?.toLowerCase()}.
                  {req?.decided_at && ` Decision made on ${new Date(req.decided_at).toLocaleDateString()}.`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Meta */}
        {req && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Request Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="font-medium">Created:</span>{" "}
                {new Date(req.created_at).toLocaleString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              {req.decided_at && (
                <div>
                  <span className="font-medium">Decided:</span>{" "}
                  {new Date(req.decided_at).toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confirm decline */}
      <ConfirmDialog
        open={showDeclineConfirm}
        title="Decline Request"
        message={`Are you sure you want to decline this request from ${req?.company || "the employer"}? This action cannot be undone.`}
        confirmText="Decline"
        cancelText="Cancel"
        busy={submitting}
        onConfirm={doDecline}
        onCancel={() => setShowDeclineConfirm(false)}
      />
    </section>
  );
}
