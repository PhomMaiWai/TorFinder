import type { WorkType } from "@/types/tor";

/**
 * The proposal library (#259), as the backend's library.types and coverage
 * send it. Dates are YYYY-MM-DD; values are baht.
 */

export type LibraryFile = { name: string; contentType: string; size: number; uploadedAt: string };

export const CLIENT_TYPES = ["government", "stateEnterprise", "private"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export type PastProject = {
  id: string;
  title: string;
  client?: string;
  clientType?: ClientType;
  value?: number;
  startedAt?: string;
  completedAt?: string;
  workTypes?: WorkType[];
  description?: string;
  file?: LibraryFile;
};

/**
 * Certifications a TOR asks of a person on the team, rather than of the
 * company. Keys and labels mirror the backend's CERTIFICATIONS.
 */
export const PERSONAL_CERTIFICATIONS = [
  { id: "pmp", label: "PMP" },
  { id: "cissp", label: "CISSP" },
  { id: "cisa", label: "CISA" },
  { id: "cism", label: "CISM" },
  { id: "oscp", label: "OSCP" },
  { id: "ceh", label: "CEH" },
  { id: "pentestplus", label: "CompTIA PenTest+" },
  { id: "securityplus", label: "CompTIA Security+" },
  { id: "giac", label: "GIAC" },
  { id: "awsAi", label: "AWS AI / ML" },
  { id: "nvidiaAi", label: "NVIDIA AI" },
  { id: "googleMl", label: "Google ML Engineer" },
  { id: "azureAi", label: "Azure AI" },
] as const;
export type PersonalCertification = (typeof PERSONAL_CERTIFICATIONS)[number]["id"];

export type TeamMember = {
  id: string;
  name: string;
  position: string;
  yearsExperience?: number;
  education?: string;
  certifications?: string[];
  skills?: string;
  file?: LibraryFile;
};

export type LibraryKind = "projects" | "team";

export type CoverageStatus = "ready" | "partial" | "missing" | "manual";

export type CoverageItem = {
  line: string;
  group: "company" | "certification" | "experience" | "personnel";
  status: CoverageStatus;
  evidence: { kind: "certificate" | "project" | "member"; id: string; label: string; hasFile: boolean }[];
  note: string;
};

export type Coverage = {
  /** False when no qualifications could be read from this TOR's documents yet. */
  extracted: boolean;
  total: number;
  ready: number;
  partial: number;
  missing: number;
  manual: number;
  items: CoverageItem[];
};
