// frontend/src/Pages/EmployerRole/ApplicantSharedCertificates.tsx
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface Certificate {
  id: number;
  certificate_id: number;
  file_hash: string;
  title: string;
  issued_on: string;
  issuer: string;
  expiry_date: string | null;
  is_expired: boolean;
  is_active: boolean;
  blockchain_synced: boolean;
  blockchain_verified: boolean;
  blockchain_tx_hash: string | null;
  blockchain_expiry: number;
  revoked_at: string | null;
  created_at: string;
}

interface ApiResponse {
  request_id: number;
  applicant_name: string;
  status: string;
  certificates: Certificate[];
  total: number;
  blockchain_verified: boolean;
}

const ApplicantSharedCertificates = () => {
  const { requestId } = useParams<{ requestId: string }>();

  // Fetch blockchain-verified shared certificates
  const { data, isLoading } = useQuery({
    queryKey: ['employer-shared-certificates', requestId],
    queryFn: async () => {
      const response = await api<ApiResponse>(`/access/employer/requests/${requestId}/shared/`);
      return response;
    },
    enabled: !!requestId,
  });

  const getExpiryStatus = (cert: Certificate) => {
    if (!cert.expiry_date) {
      return { label: 'No Expiry', color: 'bg-emerald-50 text-emerald-700' };
    }
    if (cert.is_expired) {
      return { label: 'Expired', color: 'bg-red-50 text-red-700' };
    }
    
    const days = Math.ceil(
      (new Date(cert.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (days < 30) {
      return { label: `Expires in ${days}d`, color: 'bg-yellow-50 text-yellow-700' };
    }
    return { label: `Expires in ${days}d`, color: 'bg-blue-50 text-blue-700' };
  };

  if (isLoading) {
    return (
      <section className="pt-0 pb-6">
        <div className="auth-wrap">
          <div className="text-center py-10 text-gray-500">Loading…</div>
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
              Shared{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Certificates
              </span>
            </h1>
            <p className="mt-1 text-gray-500">
              Certificates shared by {data?.applicant_name || 'applicant'}
            </p>
            {data?.blockchain_verified && (
              <p className="text-xs text-emerald-600 mt-1">
                🔗 Blockchain verified
              </p>
            )}
          </div>
          <Link
            to="/employer/access"
            className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium"
          >
            ← Back to Requests
          </Link>
        </div>

        {/* ✅ NEW: Warning for revoked certificates */}
        {data && data.certificates.some(cert => cert.revoked_at) && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex gap-3">
              <span className="text-red-600 text-xl">⚠️</span>
              <div>
                <p className="text-sm font-medium text-red-800">
                  Some certificates have been revoked
                </p>
                <p className="text-sm text-red-700 mt-1">
                  The applicant has revoked access to some certificates. 
                  You can no longer view or download these certificates.
                </p>
              </div>
            </div>
          </div>
        )}

        {!data?.certificates || data.certificates.length === 0 ? (
          <div className="auth-card">
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No certificates available</p>
              <p className="text-sm mt-2">
                Either no certificates were shared or blockchain verification failed
              </p>
            </div>
          </div>
        ) : (
          <div className="auth-card mt-0">
            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Certificate</th>
                      <th className="px-4 py-3 text-left font-semibold">Issued On</th>
                      <th className="px-4 py-3 text-left font-semibold">Shared On</th>
                      <th className="px-4 py-3 text-left font-semibold">Expiry</th>
                      <th className="px-4 py-3 text-left font-semibold">Blockchain</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.certificates.map((cert) => {
                      const expiryStatus = getExpiryStatus(cert);
                      const isRevoked = !!cert.revoked_at;
                      
                      return (
                        <tr 
                          key={cert.id} 
                          className={`hover:bg-gray-50/60 ${isRevoked ? 'opacity-50' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{cert.title}</p>
                            <p className="text-xs text-gray-500">{cert.issuer}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(cert.issued_on).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(cert.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1.5 text-xs rounded-full ${expiryStatus.color}`}>
                              {expiryStatus.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {cert.blockchain_synced ? (
                              <span
                                className="text-emerald-600 text-lg"
                                title={`Synced: ${cert.blockchain_tx_hash?.slice(0, 10)}...`}
                              >
                                ✓
                              </span>
                            ) : (
                              <span className="text-yellow-600 text-lg" title="Not synced to blockchain">
                                ⚠
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isRevoked ? (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-red-50 text-red-700">
                                Revoked
                              </span>
                            ) : cert.is_active ? (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-emerald-50 text-emerald-700">
                                Active
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-gray-50 text-gray-700">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {!isRevoked && cert.is_active && !cert.is_expired ? (
                              <Link
                                to={`/employer/certificates/${cert.id}`}
                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700"
                              >
                                View
                              </Link>
                            ) : (
                              <span className="text-gray-400 text-xs italic">
                                {isRevoked ? 'Revoked' : 'Unavailable'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ApplicantSharedCertificates;