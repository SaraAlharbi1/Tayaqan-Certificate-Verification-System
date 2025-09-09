
import EducationalLogo from "@/assets/Educational-logo.png";
import { Link } from "react-router-dom";


export default function ApplicantPage() {
  return (
    <section className="bg-gradient-to-b from-white to-surface px-6 py-12">
   
      <h1 className="text-3xl md:text-4xl font-bold text-left mb-10">
        Get Started <span className="text-blue-900">Now.</span>
      </h1>

      
      <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
        {/* My Certificates */}
        <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition">
          <div className="flex flex-col items-center justify-center p-8">
            <img
              src={EducationalLogo}
              alt="Certificates"
              className="h-16 w-16 mb-4"
            />
            <h3 className="text-2xl font-bold text-blue-900 mb-6">
              My Certificates
            </h3>
            
          <Link to="/applicant/certificates" className="btn btn-primary">
            View
           </Link>
          </div>
        </div>

        {/* Access Requests */}
        <div className="group relative rounded-2xl border border-black/5 bg-white/90 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition">
          <div className="flex flex-col items-center justify-center p-8">
            <img
              src={EducationalLogo}
              alt="Access Requests"
              className="h-16 w-16 mb-4"
            />
            <h3 className="text-2xl font-bold text-blue-900 mb-6">
              Access Requests
            </h3>
            
            <Link to="/applicant/requests" className="btn btn-primary">View</Link>

          </div>
        </div>
      </div>
    </section>
  );
}
