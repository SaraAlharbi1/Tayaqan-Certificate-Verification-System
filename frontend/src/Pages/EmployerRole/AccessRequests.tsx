// frontend/src/Pages/EmployerRole/AccessRequests.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';

interface AccessRequest {
  id: number;
  applicant_name: string;
  applicant_email?: string;
  national_id?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
  decided_at: string | null;
  shares_count?: number;
}

interface ApiResponse<T> {
  results?: T[];
  count?: number;
}

type StatusFilter = '' | 'PENDING' | 'APPROVED' | 'REJECTED';

const AccessRequests = () => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  // Fetch access requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ['employer-access-requests'],
    queryFn: async () => {
      const response = await api<ApiResponse<AccessRequest>>(`/access/employer/requests/`);
      return response.results || [];
    },
  });

  // Filter requests client-side (more reliable than API filtering)
  const filteredRequests = requests?.filter((req) => {
    if (!statusFilter) return true;
    return req.status === statusFilter;
  }) || [];

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      REJECTED: 'bg-red-100 text-red-700 border-red-200',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Count requests by status
  const counts = {
    all: requests?.length || 0,
    pending: requests?.filter((r) => r.status === 'PENDING').length || 0,
    approved: requests?.filter((r) => r.status === 'APPROVED').length || 0,
    rejected: requests?.filter((r) => r.status === 'REJECTED').length || 0,
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
              Access{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Requests
              </span>
            </h1>
            <p className="mt-1 text-gray-500">View and manage your certificate access requests</p>
          </div>
          <Link
            to="/employer/access/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Link>
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
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Pending
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === 'PENDING' ? 'bg-amber-400' : 'bg-gray-200'
            }`}>
              {counts.pending}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Approved
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === 'APPROVED' ? 'bg-emerald-400' : 'bg-gray-200'
            }`}>
              {counts.approved}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              statusFilter === 'REJECTED'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Rejected
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
              statusFilter === 'REJECTED' ? 'bg-red-400' : 'bg-gray-200'
            }`}>
              {counts.rejected}
            </span>
          </button>
        </div>

        {/* Content */}
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {statusFilter ? `No ${statusFilter.toLowerCase()} requests` : 'No access requests yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {statusFilter
                ? 'Try selecting a different filter'
                : 'Request access to applicant certificates to get started'}
            </p>
            {!statusFilter && (
              <Link
                to="/employer/access/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
              >
                Create Your First Request
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Applicant
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Requested
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Decided
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold text-sm">
                              {request.applicant_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{request.applicant_name}</p>
                            {request.applicant_email && (
                              <p className="text-sm text-gray-500">{request.applicant_email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(request.status)}`}>
                          {request.status === 'PENDING' && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></span>
                          )}
                          {request.status === 'APPROVED' && (
                            <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          {request.status === 'REJECTED' && (
                            <svg className="w-3 h-3 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(request.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {request.decided_at ? formatDate(request.decided_at) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {request.status === 'APPROVED' ? (
                          <Link
                            to={`/employer/access/${request.id}/certificates`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            View Certificates
                          </Link>
                        ) : request.status === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg">
                            <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Awaiting Response
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">No actions</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default AccessRequests;