export type CompanySize = "1-10 คน" | "11-50 คน" | "51-200 คน" | "200+ คน";

export type CompanyProfile = {
  name: string;
  taxId: string;
  email: string;
  contactName: string;
  phone: string;
  address: string;
  specialty: string;
  size: CompanySize;
  techStack: string[];
};

export const COMPANY_PROFILE: CompanyProfile = {
  name: "Arun Digital Co., Ltd",
  taxId: "0105566012345",
  email: "contact@arundigital.co.th",
  contactName: "อรุณ ดิจิทัล",
  phone: "081-234-5678",
  address: "123/45 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110",
  specialty: "Government Digital Platforms",
  size: "11-50 คน",
  techStack: ["Next.js", "Cloud", "Data Platform"],
};

export const COMPANY_SIZE_OPTIONS: CompanySize[] = [
  "1-10 คน",
  "11-50 คน",
  "51-200 คน",
  "200+ คน",
];

export const TECH_STACK_OPTIONS = [
  "Next.js",
  "Web Application",
  "API",
  "UX/UI",
  "Cloud",
  "Data Platform",
  "Mobile",
  "Dashboard",
  "CRUD",
  "Security",
  "Integration",
  "HealthTech",
  "Citizen Service",
];
