import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";

/* ---------------------- Types ---------------------- */
type BackendCert = {
  id: string | number;
  display_label?: string | null;
  institution_name?: string | null;
  issued_on?: string | null;
  file_hash?: string | null;
  tx_hash?: string | null;
  block_number?: number | null;
};

type ChainRow = {
  fileHash: string;
  exists: boolean;
  revoked: boolean;
  applicantIdHash?: string | null;
  issuedAt?: number;
};

type Row = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  fileHash: string;
  status: "ACTIVE" | "REVOKED" | "CHECKING" | "INVALID";
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/* ---------------------- Helpers ---------------------- */
const normHash = (h: string) =>
  !h ? "" : (h.startsWith("0x") ? h : "0x" + h).toLowerCase();

const fmtDate = (d?: string | null) => {
  if (!d) return "";
  const t = new Date(d);
  return isNaN(t.getTime())
    ? d || ""
    : t.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

/* =======================================================
   My Certificates (Applicant)
======================================================= */
export default function MyCertificatesPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "REVOKED">("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [canNext, setCanNext] = useState(false);
  const [canPrev, setCanPrev] = useState(false);

  const [chainByHash, setChainByHash] = useState<Record<string, ChainRow>>({});

  /* ------------------ Fetch list (DB only) ------------------ */
  const fetchPage = async (pageNum: number) => {
    setLoading(true);
    setErr(null);

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      if (q.trim()) params.set("search", q.trim());
      if (fromDate) params.set("issued_on__gte", fromDate);
      if (toDate) params.set("issued_on__lte", toDate);

      const res = await api<Paginated<BackendCert>>(
        `/certificates/my/?${params.toString()}`,
      );

      const mapped: Row[] = (res.results ?? []).map((d) => ({
        id: String(d.id),
        title: d.display_label || "Untitled Certificate",
        issuer: d.institution_name || "—",
        issueDate: fmtDate(d.issued_on),
        fileHash: d.file_hash || "",
        status: "CHECKING",
      }));

      setRows(mapped);
      setTotal(res.count ?? mapped.length);
      setCanNext(Boolean(res.next));
      setCanPrev(Boolean(res.previous));
      setLoading(false);

      if (mapped.length > 0) setTimeout(() => loadBlockchainStatuses(mapped), 50);
      else setChainByHash({});
    } catch (e: any) {
      setErr(e?.userMessage || e?.message || "Failed to load certificates.");
      setLoading(false);
      setChainByHash({});
    }
  };

  /* ------------------ Chain statuses ------------------ */
  const loadBlockchainStatuses = async (certs: Row[]) => {
    try {
      setStatusLoading(true);

      const fileHashes = Array.from(
        new Set(certs.map((c) => normHash(c.fileHash)).filter(Boolean)),
      );

      if (fileHashes.length === 0) {
        setChainByHash({});
        setStatusLoading(false);
        return;
      }

      const resp = await api<any>("/certificates/my/verify-batch/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_hashes: fileHashes }),
      });

      let arr: any[] = [];
      if (Array.isArray(resp)) arr = resp;
      else if (resp?.results) arr = resp.results;

      const map: Record<string, ChainRow> = {};
      for (const r of arr) {
        const h = normHash(r.fileHash || r.file_hash || "");
        if (h)
          map[h] = {
            fileHash: h,
            exists: !!r.exists,
            revoked: !!(r.revoked || r.is_revoked),
            applicantIdHash: r.applicantIdHash || r.applicant_id_hash || null,
            issuedAt: r.issuedAt || r.issued_at || null,
          };
      }

      setChainByHash(map);

      setRows((prev) =>
        prev.map((row) => {
          const st = map[normHash(row.fileHash)];
          if (!st) return { ...row, status: "INVALID" };
          if (!st.exists) return { ...row, status: "INVALID" };
          if (st.revoked) return { ...row, status: "REVOKED" };
          return { ...row, status: "ACTIVE" };
        }),
      );
    } finally {
      setStatusLoading(false);
    }
  };

  /* ------------------ Fetch on change ------------------ */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchPage(page);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [page, q, fromDate, toDate]);

  /* ------------------ Local status filter ------------------ */
  const filteredData = useMemo(
    () => (!statusFilter ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter],
  );

  /* --------------------------- UI --------------------------- */
  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            My{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Your issued certificates</p>
        </div>

        {err && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            {err}
          </div>
        )}

        <div className="auth-card mt-0">

          {/* Filters */}
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              placeholder="Search by title..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 border border-gray-200"
            />

            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setPage(1);
                setFromDate(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 border border-gray-200"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setPage(1);
                setToDate(e.target.value);
              }}
              className="h-12 rounded-xl bg-gray-50 px-4 border border-gray-200"
            />
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Issuer</th>
                    <th className="px-4 py-3 text-left font-semibold">Issue Date</th>
                    <th className="px-4 py-3 text-left font-semibold w-28">View</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">

                  {/* Loading */}
                  {loading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                        Loading…
                      </td>
                    </tr>
                  )}

                  {/* Data */}
                  {!loading &&
                    filteredData.map((r) => {
                      const st = r.status;
                      const isChecking = st === "CHECKING";
                      const isRevoked = st === "REVOKED";
                      const isActive = st === "ACTIVE";
                      const isInvalid = st === "INVALID";

                      return (
                        <tr key={r.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3 font-medium text-gray-900">{r.title}</td>
                          <td className="px-4 py-3 text-gray-600">{r.issuer}</td>
                          <td className="px-4 py-3 text-gray-600">{r.issueDate}</td>

                          {/* View */}
                          <td className="px-4 py-3">
                            <Link
                              to={`/applicant/certificates/${r.id}`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md"
                            >
                              View
                            </Link>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            {isChecking && (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-gray-50 text-gray-600">
                                Checking...
                              </span>
                            )}
                            {isActive && (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-emerald-50 text-emerald-700">
                                ACTIVE
                              </span>
                            )}
                            {isRevoked && (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-red-50 text-red-700">
                                REVOKED
                              </span>
                            )}
                            {isInvalid && (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-amber-50 text-amber-700">
                                INVALID
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                  {/* No data */}
                  {!loading && filteredData.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-gray-500">
                        No certificates found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}