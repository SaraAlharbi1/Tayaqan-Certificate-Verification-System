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
}

interface SharedCertificate {
  id: number;
  certificate_id: number;
  file_hash: string;
  title: string;
  issued_on: string;
  issuer: string;
  created_at: string;
  expiry_date: string | null;
  is_expired: boolean;
  is_active: boolean;
  blockchain_synced: boolean;
  revoked_at: string | null;
}

interface ApproveData {
  certificate_ids: number[];
  expiry_days: number;
}

interface ApiResponse<T> {
  results?: T[];
  certificates?: T[];
}

type StatusFilter = '' | 'PENDING' | 'APPROVED' | 'REJECTED';

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const AccessRequests = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null);
  const [selectedCertificates, setSelectedCertificates] = useState<number[]>([]);
  const [expiryDays, setExpiryDays] = useState<number>(365);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedRevokeCertificates, setSelectedRevokeCertificates] = useState<number[]>([]);

  // Fetch access requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['applicant-access-requests'],
    queryFn: async () => {
      const response = await api<ApiResponse<AccessRequest>>('/access/my/requests/');
      return response.results || [];
    },
  });

  // Filter requests
  const filteredRequests = requests?.filter((req) => {
    if (!statusFilter) return true;
    return req.status === statusFilter;
  }) || [];

  // Counts
  const counts = {
    all: requests?.length || 0,
    pending: requests?.filter((r) => r.status === 'PENDING').length || 0,
    approved: requests?.filter((r) => r.status === 'APPROVED').length || 0,
    rejected: requests?.filter((r) => r.status === 'REJECTED').length || 0,
  };

  // Fetch certificates for approval
  const { data: certificates, isLoading: certificatesLoading } = useQuery({
    queryKey: ['candidate-certificates', selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const response = await api<ApiResponse<Certificate>>(
        `/access/my/requests/${selectedRequest.id}/candidate_certificates/`
      );
      return response.certificates || [];
    },
    enabled: !!selectedRequest && approveDialogOpen,
  });

  // Fetch shared certificates for revoke
  const { data: sharedCertificates, isLoading: sharedLoading } = useQuery({
    queryKey: ['shared-certificates', selectedRequest?.id],
    queryFn: async () => {
      if (!selectedRequest) return [];
      const response = await api<{ certificates: SharedCertificate[] }>(
        `/access/my/requests/${selectedRequest.id}/shared_certificates/`
      );
      return response.certificates || [];
    },
    enabled: !!selectedRequest && revokeDialogOpen,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async (data: { requestId: number; approveData: ApproveData }) => {
      return api<{ message: string; shares_created: number; blockchain_synced: number }>(
        `/access/my/requests/${data.requestId}/approve/`,
        { method: 'POST', body: JSON.stringify(data.approveData) }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-access-requests'] });
      setApproveDialogOpen(false);
      setSelectedRequest(null);
      setSelectedCertificates([]);
    },
    onError: (error: any) => alert(`Failed: ${error.userMessage || error.message}`),
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: number) => {
      return api<{ message: string }>(`/access/my/requests/${requestId}/reject/`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-access-requests'] });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: (error: any) => alert(`Failed: ${error.userMessage || error.message}`),
  });

  const revokeMutation = useMutation({
    mutationFn: async (data: { requestId: number; certificate_ids: number[] }) => {
      return api<{ message: string; revoked_count: number }>(
        `/access/my/requests/${data.requestId}/revoke_access/`,
        { method: 'POST', body: JSON.stringify({ certificate_ids: data.certificate_ids }) }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applicant-access-requests'] });
      setRevokeDialogOpen(false);
      setSelectedRequest(null);
      setSelectedRevokeCertificates([]);
    },
    onError: (error: any) => alert(`Failed: ${error.userMessage || error.message}`),
  });

  // Handlers
  const handleCertificateToggle = (id: number) => {
    setSelectedCertificates((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleRevokeCertToggle = (id: number) => {
    setSelectedRevokeCertificates((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getStatusBadge = (status: string) => {
    const config = {
      PENDING: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '●' },
      APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✓' },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', icon: '✕' },
    };
    return config[status as keyof typeof config] || { bg: 'bg-gray-100', text: 'text-gray-600', icon: '—' };
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
            Access{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Requests
            </span>
          </h1>
          <p className="mt-1 text-gray-500">Manage employer requests to access your certificates</p>
        </div>

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
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'PENDING' ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pending <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === 'PENDING' ? 'bg-amber-400' : 'bg-gray-200'}`}>{counts.pending}</span>
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'APPROVED' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Approved <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === 'APPROVED' ? 'bg-emerald-400' : 'bg-gray-200'}`}>{counts.approved}</span>
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'REJECTED' ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Rejected <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${statusFilter === 'REJECTED' ? 'bg-red-400' : 'bg-gray-200'}`}>{counts.rejected}</span>
          </button>
        </div>

        {/* Content */}
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter ? `No ${statusFilter.toLowerCase()} requests` : 'No access requests yet'}
            </h3>
            <p className="text-gray-500">Employers will request access to your certificates here</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Employer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Requested</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Decided</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRequests.map((request) => {
                    const badge = getStatusBadge(request.status);
                    return (
                      <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <span className="text-purple-600 font-semibold text-sm">
                                {(request.employer_name || request.company_name)?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <span className="font-medium text-gray-900">{request.employer_name || request.company_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                            <span>{badge.icon}</span>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{formatDate(request.created_at)}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{request.decided_at ? formatDate(request.decided_at) : '—'}</td>
                        <td className="px-6 py-4 text-right">
                          {request.status === 'PENDING' && (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setSelectedRequest(request); setSelectedCertificates([]); setApproveDialogOpen(true); }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve
                              </button>
                              <button
                                onClick={() => { setSelectedRequest(request); setRejectDialogOpen(true); }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Reject
                              </button>
                            </div>
                          )}
                          {request.status === 'APPROVED' && (
                            <button
                              onClick={() => { setSelectedRequest(request); setSelectedRevokeCertificates([]); setRevokeDialogOpen(true); }}
                              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              Revoke
                            </button>
                          )}
                          {request.status === 'REJECTED' && <span className="text-sm text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Approve Dialog */}
        {approveDialogOpen && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Approve Request</h2>
                    <p className="text-sm text-gray-500">{selectedRequest.employer_name || selectedRequest.company_name}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Expiry */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Access Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {[{ d: 30, l: '1 Month' }, { d: 90, l: '3 Months' }, { d: 180, l: '6 Months' }, { d: 365, l: '1 Year' }, { d: 0, l: 'No Expiry' }].map(({ d, l }) => (
                      <button
                        key={d}
                        onClick={() => setExpiryDays(d)}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                          expiryDays === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Certificates */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Certificates ({selectedCertificates.length} selected)
                  </label>
                  {certificatesLoading ? (
                    <div className="py-8 text-center text-gray-500">Loading...</div>
                  ) : certificates?.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">No certificates available</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {certificates?.map((cert) => (
                        <label key={cert.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                          selectedCertificates.includes(cert.id) ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={selectedCertificates.includes(cert.id)}
                            onChange={() => handleCertificateToggle(cert.id)}
                            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{cert.display_label}</p>
                            <p className="text-sm text-gray-500">{cert.institution_name} • {formatDate(cert.issued_on)}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button onClick={() => setApproveDialogOpen(false)} disabled={approveMutation.isPending} className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={() => approveMutation.mutate({ requestId: selectedRequest.id, approveData: { certificate_ids: selectedCertificates, expiry_days: expiryDays } })}
                  disabled={approveMutation.isPending || selectedCertificates.length === 0}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Approving...' : 'Approve & Share'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Dialog */}
        {rejectDialogOpen && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Reject Request</h2>
                    <p className="text-sm text-gray-500">{selectedRequest.employer_name || selectedRequest.company_name}</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-700">Are you sure you want to reject this access request?</p>
              </div>
              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button onClick={() => setRejectDialogOpen(false)} disabled={rejectMutation.isPending} className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={() => rejectMutation.mutate(selectedRequest.id)}
                  disabled={rejectMutation.isPending}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700"
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revoke Dialog */}
        {revokeDialogOpen && selectedRequest && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Revoke Access</h2>
                    <p className="text-sm text-gray-500">{selectedRequest.employer_name || selectedRequest.company_name}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-amber-800">This will immediately remove the employer's access to the selected certificates.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Select Certificates to Revoke ({selectedRevokeCertificates.length} selected)
                  </label>
                  {sharedLoading ? (
                    <div className="py-8 text-center text-gray-500">Loading...</div>
                  ) : sharedCertificates?.filter((c) => !c.revoked_at).length === 0 ? (
                    <div className="py-8 text-center text-gray-500">No active shared certificates</div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {sharedCertificates?.filter((c) => !c.revoked_at).map((cert) => (
                        <label key={cert.id} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                          selectedRevokeCertificates.includes(cert.certificate_id) ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={selectedRevokeCertificates.includes(cert.certificate_id)}
                            onChange={() => handleRevokeCertToggle(cert.certificate_id)}
                            className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{cert.title}</p>
                            <p className="text-sm text-gray-500">{cert.issuer} • Shared {formatDate(cert.created_at)}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                <button onClick={() => setRevokeDialogOpen(false)} disabled={revokeMutation.isPending} className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
                <button
                  onClick={() => revokeMutation.mutate({ requestId: selectedRequest.id, certificate_ids: selectedRevokeCertificates })}
                  disabled={revokeMutation.isPending || selectedRevokeCertificates.length === 0}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
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

export default AccessRequests;