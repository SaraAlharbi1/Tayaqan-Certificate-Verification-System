export type Role = "APPLICANT" | "EMPLOYER" | "INSTITUTION" | "ADMIN";
export type OrgStatus = "PENDING" | "APPROVED" | "REJECTED";
export type Tokens = { access: string; refresh: string };

export type MeResponse = {
  id: number;
  email: string;
  role: Role;
  status?: OrgStatus;           // for employer/institution
  profile: Record<string, any>; // role-specific fields
};
