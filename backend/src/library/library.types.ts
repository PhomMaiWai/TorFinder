import { StoredFile } from "../common/stored-files";
import { Certification } from "../matching/requirements";
import { WorkType } from "../matching/work-types";

/**
 * The proposal library (#259): the pieces every bid repeats — past projects,
 * the team and its CVs, certificates — kept once per company instead of
 * being redone, by one person, for every proposal. Certificates are the
 * records from #260 (company.certificates); the other two live here.
 */

export const CLIENT_TYPES = ["government", "stateEnterprise", "private"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

/** A completed (or running) contract the company can cite as ผลงาน. */
export type PastProject = {
  id: string;
  title: string;
  /** Who it was for, as written on the reference letter. */
  client?: string;
  clientType?: ClientType;
  /** Contract value, baht. */
  value?: number;
  /** YYYY-MM-DD. */
  startedAt?: string;
  completedAt?: string;
  workTypes?: WorkType[];
  description?: string;
  /** The reference letter (หนังสือรับรองผลงาน) or the contract. */
  file?: StoredFile;
  createdAt: Date;
  updatedAt: Date;
};

/** Someone the company can name on a bid, with what a TOR asks of them. */
export type TeamMember = {
  id: string;
  name: string;
  /** As a TOR names roles: ผู้จัดการโครงการ, นักวิเคราะห์ระบบ, … */
  position: string;
  yearsExperience?: number;
  education?: string;
  /** Personal certifications a TOR can ask of a role: PMP, CISSP, OSCP, … */
  certifications?: Certification[];
  skills?: string;
  /** The CV. */
  file?: StoredFile;
  createdAt: Date;
  updatedAt: Date;
};

export const LIBRARY_KINDS = {
  projects: { field: "pastProjects", noun: "ผลงาน" },
  team: { field: "teamMembers", noun: "บุคลากร" },
} as const;
export type LibraryKind = keyof typeof LIBRARY_KINDS;
export type LibraryRecord = PastProject | TeamMember;

export const LIBRARY_LIMITS = {
  /** Per company and kind — a ceiling against abuse, far above a real library. */
  records: 200,
  /** The starter pack stops adding files past this; the checklist says which were left out. */
  packBytes: 60 * 1024 * 1024,
} as const;
