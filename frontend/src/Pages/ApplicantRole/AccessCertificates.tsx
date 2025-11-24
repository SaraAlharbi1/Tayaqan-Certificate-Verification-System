// frontend/src/Pages/ApplicantRole/AccessCertificates.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';

interface AccessShare {
  id: number;
  certificate: {
    id: number;
    display_label: string;
    issued_on: string;
    institution_name: string;
  };
  request: {
    id: number;
    employer_name: string;
  };
  expiry_date: string | null;
  is_expired: boolean;
  is_active: boolean;
  blockchain_synced: boolean;
  blockchain_tx_hash: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface AccessRequest {
  id: number;
  employer_name: string;
  status: string;
  shares: AccessShare[];
}

interface ApiResponse {
  results?: AccessRequest[];
  count?: number;
}

type StatusFilter = '' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const AccessCertificates = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedShare, setSelectedShare] = useState<AccessShare | null>(null);

  // Fetch all approved requests with shares
  const { data: accessRequests, isLoading } = useQuery({
    queryKey: ['applicant-approved-requests'],
    queryFn: async () => {
      const response = await api<ApiResponse>('/access/my/requests/');
      const allRequests = response.results || [];
      return allRequests.filter((req: AccessRequest) => req.status === 'APPROVED');
    },
  });

  // Flatten all shares
  const allShares: AccessShare[] = [];
  accessRequests?.forEach((request: AccessRequest) => {
    if (request.shares) {
      request.shares.forEach((share: AccessShare) => {
        allShares.push(share);
      });
    }
  });

  // Filter shares
  const filteredShares = allShares.filter((share) => {
    if (!statusFilter) return true;
    if (statusFilter === 'ACTIVE') return share.is_active && !share.revoked_at && !share.is_expired;
    if (statusFilter === 'REVOKED') return !!share.revoked_at;
    if (statusFilter === 'EXPIRED') return share.is_expired;
    return true;
  });

  // Counts
  const counts = {
    all: allShares.length,
    active: allShares.filter((s) => s.is_active && !s.revoked_at && !s.is_expired).length,
    revoked: allShares.filter((s) => !!s.revoked_at).length,
    expired: allShares.filter((s) => s.is_expired).length,
  };

  // Revoke mutation
  const revokeMutation = useMutation({
    mutationFn: async (data: { requestId: number; certificateIds: number[] }) => {
      return api<{ message: string; revoked_count: number }>(
        `/access/my/requests/${data.requestId}/revoke_access/`,
        {
          method: 'POST',
          body: JSON.stringify({ certificate_ids: data.certificateIds }),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-approved-requests'] });
      setRevokeDialogOpen(false);
      setSelectedShare(null);
    },
    onError: (error: any) => {
      alert(`Failed to revoke: ${error.userMessage || error.message}`);
    },
  });

  const handleRevokeClick = (share: AccessShare) => {
    setSelectedShare(share);
    setRevokeDialogOpen(true);
  };

  const handleRevokeConfirm = () => {
    if (!selectedShare) return;
    revokeMutation.mutate({
      requestId: selectedShare.request.id,
      certificateIds: [selectedShare.certificate.id],
    });
  };

  const getShareStatus = (share: AccessShare) => {
    if (share.revoked_at) {
      return { label: 'Revoked', bg: 'bg-red-100', text: 'text-red-700', icon: '✕' };
    }
    if (share.is_expired) {
      return { label: 'Expired', bg: 'bg-amber-100', text: 'text-amber-700', icon: '⏰' };
    }
    if (share.is_active) {
      return { label: 'Active', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✓' };
    }
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
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Shared{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Manage certificates you've shared with employers</p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === ''
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === '' ? 'bg-indigo-500' : 'bg-gray-200'
            }`}>
              {counts.all}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Active
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === 'ACTIVE' ? 'bg-emerald-400' : 'bg-gray-200'
            }`}>
              {counts.active}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('EXPIRED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'EXPIRED'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Expired
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === 'EXPIRED' ? 'bg-amber-400' : 'bg-gray-200'
            }`}>
              {counts.expired}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('REVOKED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'REVOKED'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Revoked
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === 'REVOKED' ? 'bg-red-400' : 'bg-gray-200'
            }`}>
              {counts.revoked}
            </span>
          </button>
        </div>

        {/* Content */}
        {filteredShares.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter ? `No ${statusFilter.toLowerCase()} shares` : "No shared certificates"}
            </h3>
            <p className="text-gray-500">
              {statusFilter ? 'Try selecting a different filter' : "Certificates you share with employers will appear here"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Certificate
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Shared With
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Shared On
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredShares.map((share) => {
                    const status = getShareStatus(share);
                    const canRevoke = share.is_active && !share.revoked_at && !share.is_expired;

                    return (
                      <tr key={share.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{share.certificate.display_label}</p>
                              <p className="text-sm text-gray-500">{share.certificate.institution_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-purple-600 font-semibold text-xs">
                                {share.request.employer_name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <span className="text-sm text-gray-700">{share.request.employer_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(share.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${status.bg} ${status.text}`}>
                            <span>{status.icon}</span>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {canRevoke ? (
                            <button
                              onClick={() => handleRevokeClick(share)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              Revoke
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
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

        {/* Revoke Dialog */}
        {revokeDialogOpen && selectedShare && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Revoke Access</h2>
                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  Are you sure you want to revoke <strong>{selectedShare.request.employer_name}</strong>'s access to:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="font-medium text-gray-900">{selectedShare.certificate.display_label}</p>
                  <p className="text-sm text-gray-500">{selectedShare.certificate.institution_name}</p>
                </div>
                {selectedShare.blockchain_synced && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>This revocation will be recorded on the blockchain.</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={() => setRevokeDialogOpen(false)}
                  disabled={revokeMutation.isPending}
                  className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevokeConfirm}
                  disabled={revokeMutation.isPending}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {revokeMutation.isPending ? 'Revoking...' : 'Revoke Access'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AccessCertificates;