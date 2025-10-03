import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { User, FileSearch, Clock, Building2 } from "lucide-react";
import { me } from "@/lib/auth";
import type { MeResponse } from "@/lib/types";

export default function EmployerDashboard() {
  const [userData, setUserData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await me();
        setUserData(data);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-10"></div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="h-48 bg-gray-200 rounded-2xl"></div>
            <div className="h-48 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </section>
    );
  }

  const fullName = (userData?.profile?.full_name as string) || "User";
  const firstName = fullName.split(" ")[0];
  const email = userData?.email || "N/A";
  const companyName = (userData?.profile?.company_name as string) || "N/A";
  const crNumber = (userData?.profile?.cr_number as string) || "N/A";
  const status = userData?.status;

  const showStatusBanner = status && status !== "APPROVED";

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      {/* Welcome header with gradient name */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-2">
          Welcome back,{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            {firstName}
          </span>
        </h1>
        <p className="text-gray-600 text-lg">
          Manage your access requests and view applicant certificates
        </p>
      </div>

      {/* Status Banner */}
      {showStatusBanner && (
        <div
          className={`mb-8 p-6 rounded-2xl border-2 ${
            status === "PENDING"
              ? "bg-yellow-50 border-yellow-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`p-3 rounded-full ${
                status === "PENDING" ? "bg-yellow-500" : "bg-red-500"
              }`}
            >
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3
                className={`text-lg font-bold mb-1 ${
                  status === "PENDING" ? "text-yellow-900" : "text-red-900"
                }`}
              >
                {status === "PENDING"
                  ? "Account Pending Approval"
                  : "Account Rejected"}
              </h3>
              <p
                className={
                  status === "PENDING" ? "text-yellow-700" : "text-red-700"
                }
              >
                {status === "PENDING"
                  ? "Your employer account is currently under review. You'll be notified once it's approved."
                  : "Your employer account application was not approved. Please contact support for more information."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profile Info Card */}
      {userData && (
        <div className="mb-8 p-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-indigo-600">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-3">
                Company Information
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Full Name</p>
                  <p className="font-semibold text-gray-900">{fullName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="font-semibold text-gray-900">{email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Company Name</p>
                  <p className="font-semibold text-gray-900">{companyName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">CR Number</p>
                  <p className="font-semibold text-gray-900">{crNumber}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Access Requests */}
        <Link
          to="/employer/access"
          className={`group block ${
            status !== "APPROVED" ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <div className="relative h-full rounded-2xl bg-white border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-indigo-300 p-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-100/0 group-hover:from-indigo-50/50 group-hover:to-indigo-100/30 transition-all duration-300 rounded-2xl"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-100 text-indigo-600 mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <FileSearch className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">
                  Access Requests
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">
                  View and manage your certificate access requests from applicants
                </p>
              </div>
              <div className="flex items-center text-indigo-600 font-medium mt-6 group-hover:gap-2 transition-all">
                <span>View Requests</span>
                <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        </Link>

        {/* Create New Request */}
        <Link
          to="/employer/access/new"
          className={`group block ${
            status !== "APPROVED" ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <div className="relative h-full rounded-2xl bg-white border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-purple-300 p-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 to-purple-100/0 group-hover:from-purple-50/50 group-hover:to-purple-100/30 transition-all duration-300 rounded-2xl"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-purple-100 text-purple-600 mb-5 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                <Clock className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">
                  Create New Request
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">
                  Request access to an applicant's educational certificates
                </p>
              </div>
              <div className="flex items-center text-purple-600 font-medium mt-6 group-hover:gap-2 transition-all">
                <span>Create Request</span>
                <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
