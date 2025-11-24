// frontend/src/Pages/EmployerRole/ApplicantSharedCertificates.tsx
import { useState } from 'react';
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

type StatusFilter = '' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const ApplicantSharedCertificates = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const { data, isLoading } = useQuery({
    queryKey: ['employer-shared-certificates', requestId],
    queryFn: async () => {
      return api<ApiResponse>(`/access/employer/requests/${requestId}/shared/`);
    },
    enabled: !!requestId,
  });

  const allCerts = data?.certificates || [];

  // Filter certificates
  const filteredCerts = allCerts.filter((cert) => {
    if (!statusFilter) return true;
    if (statusFilter === 'ACTIVE') return cert.is_active && !cert.revoked_at && !cert.is_expired;
    if (statusFilter === 'EXPIRED') return cert.is_expired;
    if (statusFilter === 'REVOKED') return !!cert.revoked_at;
    return true;
  });

  // Counts
  const counts = {
    all: allCerts.length,
    active: allCerts.filter((c) => c.is_active && !c.revoked_at && !c.is_expired).length,
    expired: allCerts.filter((c) => c.is_expired).length,
    revoked: allCerts.filter((c) => !!c.revoked_at).length,
  };

  const getStatus = (cert: Certificate) => {
    if (cert.revoked_at) return { label: 'Revoked', bg: 'bg-red-100', text: 'text-red-700', icon: '✕' };
    if (cert.is_expired) return { label: 'Expired', bg: 'bg-amber-100', text: 'text-amber-700', icon: '⏰' };
    if (cert.is_active) return { label: 'Active', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✓' };
    return { label: 'Inactive', bg: 'bg-gray-100', text: 'text-gray-600', icon: '—' };
  };

  if (isLoading) {
    return (
      <section className="min-h-screen bg-white py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              Shared{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Certificates
              </span>
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-purple-600 font-semibold text-sm">
                    {data?.applicant_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <span className="text-gray-700 font-medium">{data?.applicant_name || 'Applicant'}</span>
              </div>
              {data?.blockchain_verified && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Blockchain Verified
                </span>
              )}
            </div>
          </div>
          <Link
            to="/employer/access"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Requests
          </Link>
        </div>

        {/* Warning for revoked */}
        {counts.revoked > 0 && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">{counts.revoked} certificate(s) have been revoked</p>
              <p className="text-sm text-red-700 mt-1">The applicant has revoked access to some certificates.</p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === '' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === '' ? 'bg-indigo-500' : 'bg-gray-200'}`}>{counts.all}</span>
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'ACTIVE' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Active <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === 'ACTIVE' ? 'bg-emerald-400' : 'bg-gray-200'}`}>{counts.active}</span>
          </button>
          <button
            onClick={() => setStatusFilter('EXPIRED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'EXPIRED' ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Expired <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === 'EXPIRED' ? 'bg-amber-400' : 'bg-gray-200'}`}>{counts.expired}</span>
          </button>
          <button
            onClick={() => setStatusFilter('REVOKED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'REVOKED' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Revoked <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === 'REVOKED' ? 'bg-red-400' : 'bg-gray-200'}`}>{counts.revoked}</span>
          </button>
        </div>

        {/* Content */}
        {filteredCerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter ? `No ${statusFilter.toLowerCase()} certificates` : 'No certificates available'}
            </h3>
            <p className="text-gray-500">
              {statusFilter ? 'Try selecting a different filter' : 'No certificates have been shared with you yet'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Certificate</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Issued</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Shared</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCerts.map((cert) => {
                    const status = getStatus(cert);
                    const canView = cert.is_active && !cert.revoked_at && !cert.is_expired;

                    return (
                      <tr key={cert.id} className={`hover:bg-gray-50 transition-colors ${cert.revoked_at ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                              cert.revoked_at ? 'bg-red-100' : 'bg-indigo-100'
                            }`}>
                              <svg className={`w-5 h-5 ${cert.revoked_at ? 'text-red-600' : 'text-indigo-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{cert.title}</p>
                              <p className="text-sm text-gray-500">{cert.issuer}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(cert.issued_on)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(cert.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.text}`}>
                            <span>{status.icon}</span>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canView ? (
                            <Link
                              to={`/employer/certificates/${cert.id}`}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-400 italic">
                              {cert.revoked_at ? 'Access revoked' : 'Unavailable'}
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
        )}
      </div>
    </section>
  );
};

export default ApplicantSharedCertificates;