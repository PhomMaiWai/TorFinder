import { CertificateRecord, bangkokToday, isExpired } from "../certificates/certificate.types";
import { CERTIFICATIONS, Certification, requirementsOf } from "../matching/requirements";
import { WorkType, workTypesOf } from "../matching/work-types";
import { foldThaiDigits, formatBaht } from "../tor/tor-normalize";
import { PastProject, TeamMember } from "./library.types";

/**
 * Which of a TOR's qualifications the company's library already covers —
 * "4 of 7 ready" (#259). Rule-based on purpose, like matching: every verdict
 * names the library items behind it, so a company can see why, and the same
 * library always gives the same answer.
 */

export type QualificationGroup = "company" | "certification" | "experience" | "personnel";

/**
 * - ready: the library has what the line asks for.
 * - partial: some of it (one of two certificates; one PM where two are asked).
 * - missing: the line is checkable, and nothing in the library meets it.
 * - manual: nothing a library holds can answer it (legal standing, years in business…).
 */
export type CoverageStatus = "ready" | "partial" | "missing" | "manual";

export type Evidence = { kind: "certificate" | "project" | "member"; id: string; label: string; hasFile: boolean };

export type CoverageItem = {
  line: string;
  group: QualificationGroup;
  status: CoverageStatus;
  evidence: Evidence[];
  /** What was checked, in the reader's language. */
  note: string;
};

export type Coverage = {
  total: number;
  ready: number;
  partial: number;
  missing: number;
  manual: number;
  items: CoverageItem[];
};

export type CompanyLibrary = {
  certificates?: CertificateRecord[];
  pastProjects?: PastProject[];
  teamMembers?: TeamMember[];
  registeredCapital?: number;
};

// The same split as the detail page's (frontend/src/lib/tor-qualifications.ts),
// plus testers — "ผู้ทดสอบเจาะระบบต้องมี OSCP" asks for a person, not the firm.
const PERSONNEL =
  /บุคลากร|ทีมงาน|ผู้เชี่ยวชาญ|ผู้จัดการโครงการ|วิศวกร|โปรแกรมเมอร์|นักพัฒนา|นักวิเคราะห์|ผู้ทดสอบ|นักทดสอบ|วุฒิ|ปริญญา|developer|designer|engineer|manager|analyst|tester|×|อย่างน้อย\s*\d+\s*คน/i;
const COMPANY_CERTIFICATION = /ISO|IEC|CMMI|มาตรฐาน.{0,10}(?:ระบบ|การจัดการ)|ตัวแทนจำหน่าย/i;
const EXPERIENCE = /ผลงาน|ประสบการณ์|เคย|สัญญา/;

export function groupOf(line: string): QualificationGroup {
  if (PERSONNEL.test(line)) return "personnel";
  if (COMPANY_CERTIFICATION.test(line) || requirementsOf([line]).certifications.length > 0) return "certification";
  if (EXPERIENCE.test(line)) return "experience";
  return "company";
}

const GOVERNMENT = /ภาครัฐ|หน่วยงาน(?:ของ)?รัฐ|ส่วนราชการ|ราชการ|รัฐวิสาหกิจ|รัฐบาล/;
const SAME_KIND = /ประเภทเดียวกัน|ลักษณะ(?:งาน)?เดียวกัน|ลักษณะคล้ายคลึง|ลักษณะใกล้เคียง/;
const WITHIN_YEARS = /(?:ภายใน|ย้อนหลัง(?:ไม่เกิน)?|ไม่เกิน)\s*(\d+)\s*ปี/;
// `(?<!\d)`: a count is matched from its first digit only, so a long run of
// digits is scanned once, not once per digit (ASVS 1.3.12).
const PROJECT_COUNT = /(?<!\d)(\d+)\s*(?:โครงการ|สัญญา|งาน)/;
const PEOPLE_COUNT = /(?<!\d)(\d+)\s*คน/;
const YEARS_EXPERIENCE = /ประสบการณ์\D{0,80}?(\d+)\s*ปี/;

/**
 * Roles as TORs and CVs name them, in Thai and English. A line and a team
 * member match when they fall in the same family.
 */
const ROLE_FAMILIES: [string, RegExp][] = [
  ["pm", /ผู้จัดการโครงการ|project\s*manager|\bPM\b/i],
  ["architect", /สถาปนิก|architect/i],
  ["analyst", /นักวิเคราะห์|analyst|\bSA\b|\bBA\b/i],
  ["security", /ความมั่นคงปลอดภัย|ความปลอดภัย|security|เจาะระบบ|pentest/i],
  ["tester", /ผู้ทดสอบ|นักทดสอบ|tester|\bQA\b|quality\s*assurance/i],
  ["designer", /นักออกแบบ|designer|\bUX\b|\bUI\b/i],
  ["data", /นักวิทยาศาสตร์ข้อมูล|data\s*(?:scientist|engineer)|ปัญญาประดิษฐ์|\bAI\b|machine\s*learning/i],
  ["dba", /ฐานข้อมูล|database|\bDBA\b/i],
  ["network", /เครือข่าย|network/i],
  ["admin", /ผู้ดูแลระบบ|system\s*admin|sysadmin/i],
  ["developer", /โปรแกรมเมอร์|นักพัฒนา|developer|programmer|วิศวกรซอฟต์แวร์|software\s*engineer/i],
  ["support", /helpdesk|help\s*desk|ผู้ประสานงาน|support/i],
];

function roleFamily(text: string): string | null {
  return ROLE_FAMILIES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** The role a personnel line names: what comes before "×", "—", ":" or the head count. */
function roleText(line: string): string {
  return line.split(/×|—|:|จำนวน|(?<!\d)\d+\s*คน/)[0] ?? line;
}

function yearsBefore(today: string, years: number): string {
  return `${Number(today.slice(0, 4)) - years}${today.slice(4)}`;
}

const label = (cert: Certification) => CERTIFICATIONS[cert].label;

function certificationItem(line: string, library: CompanyLibrary, today: string): CoverageItem {
  const groups = requirementsOf([line]).certifications;
  if (groups.length === 0) return { line, group: "certification", status: "manual", evidence: [], note: "ตรวจเอกสารนี้เอง" };

  const records = library.certificates ?? [];
  const evidence: Evidence[] = [];
  const unmet: string[] = [];
  const lapsed: string[] = [];
  for (const group of groups) {
    const valid = records.find((record) => record.standard && group.includes(record.standard) && !isExpired(record, today));
    if (valid) {
      evidence.push({ kind: "certificate", id: valid.id, label: valid.name, hasFile: Boolean(valid.file) });
      continue;
    }
    const names = group.map(label).join(" หรือ ");
    unmet.push(names);
    if (records.some((record) => record.standard && group.includes(record.standard))) lapsed.push(names);
  }

  const status: CoverageStatus = unmet.length === 0 ? "ready" : evidence.length ? "partial" : "missing";
  const note =
    status === "ready"
      ? "มีใบรับรองที่ยังไม่หมดอายุ"
      : lapsed.length
        ? `ใบรับรองหมดอายุแล้ว: ${lapsed.join(", ")}`
        : `ยังไม่มีใบรับรอง: ${unmet.join(", ")}`;
  return { line, group: "certification", status, evidence, note };
}

function experienceItem(line: string, library: CompanyLibrary, today: string, torTypes: WorkType[]): CoverageItem {
  if (!/ผลงาน/.test(line)) return { line, group: "experience", status: "manual", evidence: [], note: "ตรวจข้อนี้เอง" };

  const minValue = requirementsOf([line]).minPastContract;
  const government = GOVERNMENT.test(line);
  const sameKind = SAME_KIND.test(line) && torTypes.length > 0;
  const withinYears = Number(WITHIN_YEARS.exec(line)?.[1]) || null;
  const needed = Math.max(1, Number(PROJECT_COUNT.exec(line)?.[1]) || 1);
  const since = withinYears ? yearsBefore(today, withinYears) : null;

  const fits = (library.pastProjects ?? []).filter((project) => {
    if (minValue && !(project.value && project.value >= minValue)) return false;
    if (government && project.clientType !== "government" && project.clientType !== "stateEnterprise") return false;
    if (sameKind && project.workTypes?.length && !project.workTypes.some((type) => torTypes.includes(type))) return false;
    const finished = project.completedAt ?? project.startedAt;
    if (since && !(finished && finished >= since)) return false;
    return true;
  });

  const asked = [
    government && "งานภาครัฐ",
    minValue && `มูลค่าไม่น้อยกว่า ${formatBaht(minValue)}`,
    withinYears && `ภายใน ${withinYears} ปี`,
    sameKind && "ประเภทเดียวกัน",
  ].filter(Boolean);
  const status: CoverageStatus = fits.length >= needed ? "ready" : fits.length ? "partial" : "missing";
  return {
    line,
    group: "experience",
    status,
    evidence: fits.slice(0, Math.max(needed, 3)).map((project) => ({
      kind: "project",
      id: project.id,
      label: project.title,
      hasFile: Boolean(project.file),
    })),
    note: `ต้องการ ${needed} ผลงาน${asked.length ? ` (${asked.join(", ")})` : ""} — ในคลังตรง ${fits.length} ผลงาน`,
  };
}

function personnelItem(line: string, library: CompanyLibrary): CoverageItem {
  const role = roleText(line);
  const family = roleFamily(role);
  const needed = Math.max(1, Number(PEOPLE_COUNT.exec(line)?.[1]) || 1);
  const years = Number(YEARS_EXPERIENCE.exec(line)?.[1]) || null;
  const certGroups = requirementsOf([line]).certifications;

  const fits = (library.teamMembers ?? []).filter((member) => {
    if (family && roleFamily(member.position) !== family) return false;
    if (years && !(member.yearsExperience !== undefined && member.yearsExperience >= years)) return false;
    return certGroups.every((group) => group.some((cert) => member.certifications?.includes(cert)));
  });

  const asked = [
    years && `ประสบการณ์ ${years} ปีขึ้นไป`,
    ...certGroups.map((group) => group.map(label).join(" หรือ ")),
  ].filter(Boolean);
  const status: CoverageStatus = fits.length >= needed ? "ready" : fits.length ? "partial" : "missing";
  return {
    line,
    group: "personnel",
    status,
    evidence: fits.slice(0, needed).map((member) => ({
      kind: "member",
      id: member.id,
      label: `${member.name} (${member.position})`,
      hasFile: Boolean(member.file),
    })),
    note: `ต้องการ ${needed} คน${asked.length ? ` (${asked.join(", ")})` : ""}${family ? "" : " — ตรวจตำแหน่งเอง"} — ในคลังตรง ${fits.length} คน`,
  };
}

function companyItem(line: string, library: CompanyLibrary): CoverageItem {
  const capital = requirementsOf([line]).minRegisteredCapital;
  if (!capital) return { line, group: "company", status: "manual", evidence: [], note: "ตรวจข้อนี้เอง" };
  if (library.registeredCapital === undefined) {
    return { line, group: "company", status: "manual", evidence: [], note: "กรอกทุนจดทะเบียนในโปรไฟล์เพื่อให้ตรวจได้" };
  }
  const met = library.registeredCapital >= capital;
  return {
    line,
    group: "company",
    status: met ? "ready" : "missing",
    evidence: [],
    note: `ทุนจดทะเบียนในโปรไฟล์ ${formatBaht(library.registeredCapital)}`,
  };
}

export function coverageOf(
  qualifications: string[],
  library: CompanyLibrary,
  { torTitle = "", today = bangkokToday() }: { torTitle?: string; today?: string } = {},
): Coverage {
  const torTypes = workTypesOf(torTitle);
  const items = qualifications.map((raw): CoverageItem => {
    // Parsed with Thai digits folded; shown as the document printed it.
    const line = foldThaiDigits(raw).replace(/\s+/g, " ").trim();
    const group = groupOf(line);
    const item =
      group === "personnel"
        ? personnelItem(line, library)
        : group === "certification"
          ? certificationItem(line, library, today)
          : group === "experience"
            ? experienceItem(line, library, today, torTypes)
            : companyItem(line, library);
    return { ...item, line: raw.trim() };
  });

  const count = (status: CoverageStatus) => items.filter((item) => item.status === status).length;
  return {
    total: items.length,
    ready: count("ready"),
    partial: count("partial"),
    missing: count("missing"),
    manual: count("manual"),
    items,
  };
}
