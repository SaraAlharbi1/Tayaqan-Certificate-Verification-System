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

const AccessCertificates = () => {
  const queryClient = useQueryClient();
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

  // Revoke access mutation
  const revokeMutation = useMutation({
    mutationFn: async (data: { requestId: number; certificateIds: number[] }) => {
      const response = await api<{ message: string; revoked_count: number }>(
        `/access/my/requests/${data.requestId}/revoke_access/`,
        {
          method: 'POST',
          body: JSON.stringify({ certificate_ids: data.certificateIds }),
        }
      );
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['applicant-approved-requests'] });
      setRevokeDialogOpen(false);
      setSelectedShare(null);
      alert(`Access revoked successfully! ${data.revoked_count} certificate(s) updated.`);
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

  const getExpiryStatus = (share: AccessShare) => {
    if (!share.expiry_date) {
      return { label: 'No Expiry', color: 'bg-emerald-50 text-emerald-700' };
    }
    if (share.is_expired) {
      return { label: 'Expired', color: 'bg-red-50 text-red-700' };
    }
    const days = Math.ceil(
      (new Date(share.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
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

  // Flatten all shares from all requests
  const allShares: AccessShare[] = [];
  accessRequests?.forEach((request: AccessRequest) => {
    if (request.shares) {
      request.shares.forEach((share: AccessShare) => {
        allShares.push(share);
      });
    }
  });

  return (
    <section className="pt-0 pb-6">
      <div className="auth-wrap">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Shared{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Certificates
            </span>
          </h1>
          <p className="mt-1 text-gray-500">View and manage certificates you've shared with employers</p>
        </div>

        {allShares.length === 0 ? (
          <div className="auth-card">
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">You haven't shared any certificates yet</p>
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
                      <th className="px-4 py-3 text-left font-semibold">Employer</th>
                      <th className="px-4 py-3 text-left font-semibold">Shared On</th>
                      <th className="px-4 py-3 text-left font-semibold">Expiry</th>
                      <th className="px-4 py-3 text-left font-semibold">Blockchain</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allShares.map((share) => {
                      const expiryStatus = getExpiryStatus(share);
                      return (
                        <tr key={share.id} className="hover:bg-gray-50/60">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{share.certificate.display_label}</p>
                            <p className="text-xs text-gray-500">{share.certificate.institution_name}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{share.request.employer_name}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {new Date(share.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1.5 text-xs rounded-full ${expiryStatus.color}`}>
                              {expiryStatus.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {share.blockchain_synced ? (
                              <span
                                className="text-emerald-600 text-lg"
                                title={`Synced: ${share.blockchain_tx_hash?.slice(0, 10)}...`}
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
                            {share.revoked_at ? (
                              <span className="px-3 py-1.5 text-xs rounded-full bg-red-50 text-red-700">
                                Revoked
                              </span>
                            ) : share.is_active ? (
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
                            {!share.revoked_at && share.is_active && (
                              <button
                                onClick={() => handleRevokeClick(share)}
                                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                              >
                                Revoke
                              </button>
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

        {/* Revoke Dialog */}
        {revokeDialogOpen && selectedShare && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Revoke Access</h2>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-700">
                  Are you sure you want to revoke access to{' '}
                  <strong>{selectedShare.certificate.display_label}</strong> from{' '}
                  <strong>{selectedShare.request.employer_name}</strong>?
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  ⚠ This will remove the employer's ability to view this certificate.
                  {selectedShare.blockchain_synced && ' The revocation will be recorded on the blockchain.'}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={() => setRevokeDialogOpen(false)}
                  disabled={revokeMutation.isPending}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRevokeConfirm}
                  disabled={revokeMutation.isPending}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {revokeMutation.isPending ? 'Revoking…' : 'Revoke Access'}
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