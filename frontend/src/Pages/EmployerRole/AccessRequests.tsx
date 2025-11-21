// frontend/src/Pages/EmployerRole/AccessRequests.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface AccessRequest {
  id: number;
  applicant_name: string;
  applicant_email?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  decided_at: string | null;
  shares_count?: number;
}

interface ApiResponse<T> {
  results?: T[];
  count?: number;
}

const AccessRequests = () => {
  const [statusFilter, setStatusFilter] = useState<'' | 'PENDING' | 'APPROVED' | 'REJECTED'>('');

  // Fetch access requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['employer-access-requests', statusFilter],
    queryFn: async () => {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const response = await api<ApiResponse<AccessRequest>>(`/access/employer/requests/${params}`);
      return response.results || [];
    },
  });

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
              Access{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Requests
              </span>
            </h1>
            <p className="mt-1 text-gray-500">View and manage your certificate access requests</p>
          </div>
          <Link
            to="/employer/access/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              statusFilter === ''
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              statusFilter === 'PENDING'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              statusFilter === 'APPROVED'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Approved
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              statusFilter === 'REJECTED'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Rejected
          </button>
        </div>

        {requests?.length === 0 ? (
          <div className="auth-card">
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">
                {statusFilter
                  ? `No ${statusFilter.toLowerCase()} requests found`
                  : 'No access requests yet'}
              </p>
              {!statusFilter && (
                <Link
                  to="/employer/access/new"
                  className="inline-block mt-4 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
                >
                  Create Your First Request
                </Link>
              )}
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
                      <th className="px-4 py-3 text-left font-semibold">Applicant</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-left font-semibold">Requested On</th>
                      <th className="px-4 py-3 text-left font-semibold">Decided On</th>
                      <th className="px-4 py-3 text-left font-semibold">Certificates</th>
                      <th className="px-4 py-3 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {requests?.map((request: AccessRequest) => (
                      <tr key={request.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{request.applicant_name}</p>
                          {request.applicant_email && (
                            <p className="text-xs text-gray-500">{request.applicant_email}</p>
                          )}
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
                        <td className="px-4 py-3 text-gray-600">
                          {request.status === 'APPROVED' && request.shares_count
                            ? `${request.shares_count} shared`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {request.status === 'APPROVED' && (
                            <Link
                              to={`/employer/access/${request.id}/certificates`}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700"
                            >
                              View Certificates
                            </Link>
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
      </div>
    </section>
  );
};

export default AccessRequests;