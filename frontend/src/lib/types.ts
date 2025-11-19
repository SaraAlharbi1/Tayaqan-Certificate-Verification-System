export type Role = "APPLICANT" | "EMPLOYER" | "INSTITUTION" | "ADMIN";
export type OrgStatus = "PENDING" | "APPROVED" | "REJECTED";
export type Tokens = { access: string; refresh: string };

// Institution profile fields (returned from /me)
export type InstitutionProfile = {
  institution_name: string;
  institution_id: string | null;        // NEW: e.g., "KSU-001"
  official_email: string;
  phone: string;
  wallet_address: string;
  contract_address: string | null;      // NEW: CertificateRegistry address
};

// Applicant profile
export type ApplicantProfile = {
  full_name: string;
  national_id: string;
  phone: string;
  wallet_address: string;
};

// Employer profile
export type EmployerProfile = {
  full_name: string;
  company_name: string;
  official_email: string;
  phone: string;
};

export type MeResponse = {
  id: number;
  email: string;
  role: Role;
  status?: OrgStatus;
  profile: InstitutionProfile | ApplicantProfile | EmployerProfile | Record<string, any>;
};