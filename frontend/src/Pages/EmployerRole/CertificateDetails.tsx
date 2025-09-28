// src/Pages/EmployerRole/CertificateDetails.tsx
import { useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";

/** Shape of a certificate detail record (mocked for now). */
type CertificateDetails = {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  serial: string;

  // On-chain / proof fields
  contract: string;      // contract address
  etherscan: string;     // etherscan url for contract/tx
  hash: string;          // on-chain record hash (e.g., metadata hash)
  blockTime: string;     // display time
  fileHash: string;      // off-chain file hash (e.g., IPFS CID or SHA256)
  status: "Valid" | "Revoked";

  // PDF
  pdfUrl: string;
};

/** Demo DB keyed by certificateId from the list view. */
const MOCK_CERTS: Record<string, CertificateDetails> = {
  "ml-basics-001": {
    id: "ml-basics-001",
    title: "AI & Machine Learning (Basics)",
    issuer: "IBM Skills Academy",
    issueDate: "19-06-2024",
    serial: "IT-2406-00173",
    contract: "0x1234abcd5678ef901234abcd5678ef901234abcd",
    etherscan: "https://sepolia.etherscan.io/address/0x1234abcd5678ef901234abcd5678ef901234abcd",
    hash: "0x9fab12cd34ef56ab78cd90ef12ab34cd56ef78ab90cd12ef34ab56cd78ef90aa",
    blockTime: "June 16, 2024, 12:34 PM",
    fileHash: "0xABCDEF0123456789",
    status: "Valid",
    pdfUrl: "https://example.com/certificates/ml-basics-001.pdf",
  },
  "cyber-001": {
    id: "cyber-001",
    title: "Cybersecurity Fundamentals",
    issuer: "Cisco Academy",
    issueDate: "20-09-2023",
    serial: "CS-2309-00450",
    contract: "0x7777aaaa9999bbbbccccddddeeeeffff11112222",
    etherscan: "https://sepolia.etherscan.io/address/0x7777aaaa9999bbbbccccddddeeeeffff11112222",
    hash: "0x4b2c88aa11dd99ee55aa66cc77ee33dd55aa77cc99bb22ee44aa66cc77dd99ee",
    blockTime: "Sep 20, 2023, 09:45 AM",
    fileHash: "0xFEDCBA9876543210",
    status: "Valid",
    pdfUrl: "https://example.com/certificates/cyber-001.pdf",
  },
};

function truncate(s: string, left = 6, right = 4) {
  if (!s) return "";
  return s.length <= left + right ? s : `${s.slice(0, left)}...${s.slice(-right)}`;
}

export default function CertificateDetailsPage() {
  const { certificateId = "" } = useParams<{ certificateId: string }>();
  const cert = useMemo(() => MOCK_CERTS[certificateId], [certificateId]);
  const location = useLocation();
  const backTo = (location.state as any)?.from || "/AccessRequests";

  if (!cert) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="text-2xl font-bold mb-4">Certificate not found</h1>
        <p className="text-gray-600 mb-6">
          We couldn’t find details for the requested certificate.
        </p>
        <Link to={backTo} className="btn btn-primary">Go back </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 pt-10 pb-24">
      {/* Title */}
      <h1 className="text-2xl font-bold mb-6">{cert.title}</h1>

      {/* Table of shared certificates (top list) */}
      <div className="overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm mb-8">
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
              <tr className="hover:bg-gray-50/60">
                <td className="px-4 py-3">{cert.title}</td>
                <td className="px-4 py-3">{cert.issuer}</td>
                <td className="px-4 py-3">{cert.issueDate}</td>
                <td className="px-4 py-3">{cert.serial}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <a
                      href={cert.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary"
                    >
                      View
                    </a>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Blockchain Proof card */}
      <div className="rounded-xl border border-black/10 bg-white shadow-sm p-6 md:p-8">
        <h2 className="font-semibold text-brand-700 mb-4">Blockchain Proof</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-y-3">
          <dt className="text-gray-500">Contract:</dt>
          <dd className="sm:col-span-2">
            {truncate(cert.contract)}
            {"  "}
            <a
              href={cert.etherscan}
              target="_blank"
              rel="noreferrer"
              className="text-brand-600 hover:underline ml-2"
            >
              [View on Etherscan]
            </a>
          </dd>

          <dt className="text-gray-500">Hash:</dt>
          <dd className="sm:col-span-2">{truncate(cert.hash)}</dd>

          <dt className="text-gray-500">Block Timestamp:</dt>
          <dd className="sm:col-span-2">{cert.blockTime}</dd>

          <dt className="text-gray-500">File Hash:</dt>
          <dd className="sm:col-span-2">{truncate(cert.fileHash)}</dd>

          <dt className="text-gray-500">Status:</dt>
          <dd className="sm:col-span-2">
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-sm">
              {cert.status}
            </span>
          </dd>
        </dl>

        <div className="mt-6 flex justify-end">
          <a
            href={cert.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            View PDF
          </a>
        </div>
      </div>
    </section>
  );
}
