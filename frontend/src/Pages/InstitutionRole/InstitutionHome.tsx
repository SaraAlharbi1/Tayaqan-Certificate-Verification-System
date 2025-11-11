// src/pages/institution/InstitutionDashboard.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { University, FileText, Upload, LogOut } from "lucide-react";
import { me, logout } from "@/lib/auth";
import type { MeResponse } from "@/lib/types";

export default function InstitutionDashboard() {
  const [userData, setUserData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

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

  const institutionName = (userData?.profile?.institution_name as string) || "Institution";
  const email = (userData?.profile?.official_email as string) || userData?.email || "N/A";
  const phone = (userData?.profile?.phone as string) || "N/A";
  const status = userData?.status || "PENDING";
  const showStatusBanner = status && status !== "APPROVED";

  return (
    <section className="max-w-6xl mx-auto px-6 py-10">
      {/* Welcome header with logout button */}
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Welcome back,{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              {institutionName}
            </span>
          </h1>
          <p className="mt-2 text-gray-600 text-lg">
            Manage your institution’s certificates and student records
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 text-red-700 hover:from-red-100 hover:to-pink-100 hover:border-red-300 hover:shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <LogOut className="w-4 h-4 group-hover:scale-110 group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-semibold text-sm">Logout</span>
        </button>
      </div>

      {/* Status banner */}
      {showStatusBanner && (
        <div
          className={`mb-8 p-6 rounded-2xl border-2 ${
            status === "PENDING" ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${status === "PENDING" ? "bg-yellow-500" : "bg-red-500"}`}>
              <University className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className={`text-lg font-bold mb-1 ${status === "PENDING" ? "text-yellow-900" : "text-red-900"}`}>
                {status === "PENDING" ? "Account Pending Approval" : "Account Rejected"}
              </h3>
              <p className={status === "PENDING" ? "text-yellow-700" : "text-red-700"}>
                {status === "PENDING"
                  ? "Your institution account is currently under review. You'll be notified once it's approved."
                  : "Your institution account was not approved. Please contact support for more information."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Institution profile info */}
      {userData && (
        <div className="mb-8 p-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-indigo-600">
              <University className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-3">Institution Information</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Institution Name</p>
                  <p className="font-semibold text-gray-900">{institutionName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="font-semibold text-gray-900">{email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Phone</p>
                  <p className="font-semibold text-gray-900">{phone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action cards */}
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          to="/institution/certificates"
          className={`group block ${status !== "APPROVED" ? "pointer-events-none opacity-50" : ""}`}
        >
          <div className="relative h-full rounded-2xl bg-white border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-indigo-300 p-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-indigo-100/0 group-hover:from-indigo-50/50 group-hover:to-indigo-100/30 transition-all duration-300 rounded-2xl"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-indigo-100 text-indigo-600 mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <FileText className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors">
                  Issued Certificates
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">
                  Browse and manage certificates issued by your institution
                </p>
              </div>
              <div className="flex items-center text-indigo-600 font-medium mt-6 group-hover:gap-2 transition-all">
                <span>View Certificates</span>
                <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        </Link>

        <Link
          to="/institution/upload"
          className={`group block ${status !== "APPROVED" ? "pointer-events-none opacity-50" : ""}`}
        >
          <div className="relative h-full rounded-2xl bg-white border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:border-purple-300 p-8 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/0 to-purple-100/0 group-hover:from-purple-50/50 group-hover:to-purple-100/30 transition-all duration-300 rounded-2xl"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-purple-100 text-purple-600 mb-5 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300">
                <Upload className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">
                  Upload Certificate
                </h3>
                <p className="text-gray-600 text-base leading-relaxed">
                  Upload and issue new certificates to applicants
                </p>
              </div>
              <div className="flex items-center text-purple-600 font-medium mt-6 group-hover:gap-2 transition-all">
                <span>Upload Now</span>
                <span className="transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
