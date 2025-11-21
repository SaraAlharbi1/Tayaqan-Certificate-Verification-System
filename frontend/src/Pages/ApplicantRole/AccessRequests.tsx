// frontend/src/Pages/ApplicantRole/AccessRequests.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AccessRequest {
  id: number;
  employer_name: string;
  company_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  decided_at: string | null;
}

interface Certificate {
  id: number;
  display_label: string;
  issued_on: string;
  institution_name: string;
  file_hash: string;
  status?: string;
}

interface ApproveData {
  certificate_ids: number[];
  expiry_days: number;
}

interface ApiResponse<T> {
  results?: T[];
  certificates?: T[];
  count?: number;
}

const AccessRequests = () => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedCertificates, setSelectedCertificates] = useState<number[]>([]);
  const [expiryDays, setExpiryDays] = useState<number>(365);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  // Fetch access requests
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['applicant-access-requests'],
    queryFn: async () => {
      const response = await api<ApiResponse<AccessRequest>>('/access/my/requests/');
      return response.results || [];
    },
  });

  // Fetch candidate certificates for selected request
  const { data: certificates, isLoading: certificatesLoading } = useQuery({
    queryKey: ['candidate-certificates', selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const response = await api<ApiResponse<Certificate>>(
        `/access/my/requests/${selectedRequest.id}/candidate_certificates/`
      );
      return response.certificates || [];
    },
    enabled: !!selectedRequest,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { requestId: number; approveData: ApproveData }) => {
      const response = await api<{
        message: string;
        shares_created: number;
        blockchain_synced: number;
        blockchain_errors?: any[];
        warning?: string;
      }>(`/access/my/requests/${data.requestId}/approve/`, {
        method: 'POST',
        body: JSON.stringify(data.approveData),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['applicant-access-requests'] });
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      setSelectedCertificates([]);
      setExpiryDays(365);

      let message = `✓ Request approved!\n\n${data.shares_created} certificate(s) shared successfully.`;
      
      if (data.blockchain_synced < data.shares_created) {
        message += `\n\n⚠ Warning: Only ${data.blockchain_synced} of ${data.shares_created} synced to blockchain.`;
        if (data.warning) {
          message += `\n${data.warning}`;
        }
      } else {
        message += `\n\n🔗 All certificates synced to blockchain.`;
      }

      alert(message);
    },
    onError: (error: any) => {
      alert(`Failed to approve: ${error.userMessage || error.message}`);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const response = await api<{ message: string }>(`/access/my/requests/${requestId}/reject/`, {
        method: 'POST',
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-access-requests'] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      alert('Request rejected successfully');
    },
    onError: (error: any) => {
      alert(`Failed to reject: ${error.userMessage || error.message}`);
    },
  });

  const handleApproveClick = (request: AccessRequest) => {
    setSelectedRequest(request);
    setSelectedCertificates([]);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (request: AccessRequest) => {
    setSelectedRequest(request);
    setRejectDialogOpen(true);
  };

  const handleCertificateToggle = (certId: number) => {
    setSelectedCertificates((prev) =>
      prev.includes(certId) ? prev.filter((id) => id !== certId) : [...prev, certId]
    );
  };

  const handleApproveConfirm = () => {
    if (!selectedRequest || selectedCertificates.length === 0) {
      alert('Please select at least one certificate');
      return;
    }

    approveMutation.mutate({
      requestId: selectedRequest.id,
      approveData: {
        certificate_ids: selectedCertificates,
        expiry_days: expiryDays,
      },
    });
  };

  const handleRejectConfirm = () => {
    if (!selectedRequest) return;
    rejectMutation.mutate(selectedRequest.id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700';
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700';
      case 'REJECTED':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  const getExpiryLabel = (days: number) => {
    if (days === 0) return 'No expiry (Permanent)';
    if (days === 30) return '30 days (1 month)';
    if (days === 90) return '90 days (3 months)';
    if (days === 180) return '180 days (6 months)';
    if (days === 365) return '365 days (1 year)';
    return `${days} days`;
  };

  if (requestsLoading) {
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
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Access{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Requests
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Manage employer requests to access your certificates</p>
        </div>

        {requests?.length === 0 ? (
          <div className="auth-card">
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">No access requests yet</p>
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
                      <th className="px-4 py-3 text-left font-semibold">Employer</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Requested On</th>
                      <th className="px-4 py-3 text-left font-semibold">Decided On</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requests?.map((request: AccessRequest) => (
                      <tr key={request.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {request.employer_name || request.company_name}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1.5 text-xs rounded-full ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(request.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {request.decided_at ? new Date(request.decided_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {request.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveClick(request)}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-md hover:bg-emerald-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectClick(request)}
                                className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-md hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Approve Dialog */}
        {approveDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  Approve Access Request
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  From {selectedRequest?.employer_name || selectedRequest?.company_name}
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Expiry Selector */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Access Expiry Period
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {[0, 30, 90, 180, 365].map((days) => (
                      <button
                        key={days}
                        onClick={() => setExpiryDays(days)}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                          expiryDays === days
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {getExpiryLabel(days)}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="Custom days"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    {expiryDays === 0
                      ? 'Permanent access (no expiry)'
                      : `Access will expire in ${expiryDays} days`}
                  </p>
                </div>

                {/* Certificate Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Certificates to Share
                  </label>
                  {certificatesLoading ? (
                    <div className="text-center py-10 text-gray-500">Loading certificates…</div>
                  ) : certificates?.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      No certificates available to share
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {certificates?.map((cert: Certificate) => (
                        <label
                          key={cert.id}
                          className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCertificates.includes(cert.id)}
                            onChange={() => handleCertificateToggle(cert.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{cert.display_label}</p>
                            <p className="text-sm text-gray-500">
                              {cert.institution_name} • Issued: {new Date(cert.issued_on).toLocaleDateString()}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={() => setApproveDialogOpen(false)}
                  disabled={approveMutation.isPending}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveConfirm}
                  disabled={approveMutation.isPending || selectedCertificates.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {approveMutation.isPending ? 'Approving…' : 'Approve & Share'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Dialog */}
        {rejectDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Reject Access Request</h2>
              </div>

              <div className="p-6">
                <p className="text-gray-700">
                  Are you sure you want to reject the access request from{' '}
                  <strong>{selectedRequest?.employer_name || selectedRequest?.company_name}</strong>?
                </p>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button
                  onClick={() => setRejectDialogOpen(false)}
                  disabled={rejectMutation.isPending}
                  className="px-5 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectConfirm}
                  disabled={rejectMutation.isPending}
                  className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AccessRequests;