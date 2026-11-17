import { CertificateRecord } from "../certificates/certificate.types";
import { StoredFile } from "../common/stored-files";
import { CERTIFICATIONS } from "../matching/requirements";
import { formatBaht } from "../tor/tor-normalize";
import { Coverage, CoverageStatus, Evidence } from "./coverage";
import { CLIENT_TYPES, ClientType, PastProject, TeamMember } from "./library.types";

/**
 * The starter pack for one TOR (#259): a checklist of every qualification
 * with what in the library covers it, and the files behind that evidence,
 * foldered the way a proposal is put together. Something to start the bid
 * from, not the bid itself.
 */

export type PackTor = { title: string; agency: string; projectNumber?: string; sourceUrl?: string };

export type PackFile = {
  /** Path inside the ZIP. */
  path: string;
  bucket: "certificate" | "library";
  file: StoredFile;
};

export type PackLibrary = {
  certificates: CertificateRecord[];
  pastProjects: PastProject[];
  teamMembers: TeamMember[];
};

export const CHECKLIST_NAME = "00-รายการตรวจความพร้อม.html";

const FOLDERS = { certificate: "1-ใบรับรอง", project: "2-ผลงาน", member: "3-บุคลากร" } as const;

const STATUS_LABEL: Record<CoverageStatus, string> = {
  ready: "พร้อม",
  partial: "พร้อมบางส่วน",
  missing: "ยังไม่มี",
  manual: "เตรียมเอง",
};

const CLIENT_LABEL: Record<ClientType, string> = {
  government: "หน่วยงานรัฐ",
  stateEnterprise: "รัฐวิสาหกิจ",
  private: "เอกชน",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/** Safe as one path segment on Windows and macOS alike. */
function segment(text: string): string {
  return text.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "file";
}

/**
 * Which files go in, under which path: only the evidence the checklist
 * cites, each once, in the order it is first cited.
 */
export function planFiles(coverage: Coverage, library: PackLibrary): PackFile[] {
  const byId = {
    certificate: new Map(library.certificates.map((record) => [record.id, record])),
    project: new Map(library.pastProjects.map((record) => [record.id, record])),
    member: new Map(library.teamMembers.map((record) => [record.id, record])),
  };
  const seen = new Set<string>();
  const used = new Set<string>();
  const files: PackFile[] = [];

  const add = (evidence: Evidence) => {
    const key = `${evidence.kind}:${evidence.id}`;
    if (seen.has(key)) return;
    seen.add(key);

    let file: StoredFile | undefined;
    let stem: string;
    if (evidence.kind === "certificate") {
      const record = byId.certificate.get(evidence.id);
      file = record?.file;
      stem = record?.name ?? evidence.label;
    } else if (evidence.kind === "project") {
      const record = byId.project.get(evidence.id);
      file = record?.file;
      stem = record?.title ?? evidence.label;
    } else {
      const record = byId.member.get(evidence.id);
      file = record?.file;
      stem = record ? `${record.name} - CV` : evidence.label;
    }
    if (!file) return;

    const extension = file.name.slice(file.name.lastIndexOf("."));
    let path = `${FOLDERS[evidence.kind]}/${segment(stem)}${extension}`;
    for (let n = 2; used.has(path); n += 1) path = `${FOLDERS[evidence.kind]}/${segment(stem)} (${n})${extension}`;
    used.add(path);
    files.push({ path, bucket: evidence.kind === "certificate" ? "certificate" : "library", file });
  };

  for (const item of coverage.items) item.evidence.forEach(add);
  return files;
}

/** The checklist page: self-contained HTML that opens and prints in any browser. */
export function checklistHtml(
  tor: PackTor,
  coverage: Coverage,
  library: PackLibrary,
  { included, skipped, generatedAt }: { included: PackFile[]; skipped: PackFile[]; generatedAt: string },
): string {
  const pathOf = new Map(included.map((file) => [file.file.id, file.path]));
  const evidenceFile = (evidence: Evidence): string | undefined => {
    const record =
      evidence.kind === "certificate"
        ? library.certificates.find((item) => item.id === evidence.id)
        : evidence.kind === "project"
          ? library.pastProjects.find((item) => item.id === evidence.id)
          : library.teamMembers.find((item) => item.id === evidence.id);
    return record?.file ? pathOf.get(record.file.id) : undefined;
  };

  const rows = coverage.items
    .map((item, index) => {
      const evidence = item.evidence.length
        ? `<ul>${item.evidence
            .map((entry) => {
              const path = evidenceFile(entry);
              return `<li>${escapeHtml(entry.label)}${
                path ? ` — <a href="${encodeURI(path)}">${escapeHtml(path)}</a>` : entry.hasFile ? "" : " <em>(ยังไม่มีไฟล์)</em>"
              }</li>`;
            })
            .join("")}</ul>`
        : "";
      return `<tr class="${item.status}"><td>${index + 1}</td><td>${escapeHtml(item.line)}</td><td><strong>${
        STATUS_LABEL[item.status]
      }</strong><br><small>${escapeHtml(item.note)}</small>${evidence}</td></tr>`;
    })
    .join("\n");

  const projects = library.pastProjects
    .map(
      (project) =>
        `<tr><td>${escapeHtml(project.title)}</td><td>${escapeHtml(project.client ?? "-")}${
          project.clientType && CLIENT_TYPES.includes(project.clientType) ? ` (${CLIENT_LABEL[project.clientType]})` : ""
        }</td><td>${project.value ? escapeHtml(formatBaht(project.value)) : "-"}</td><td>${escapeHtml(
          [project.startedAt, project.completedAt].filter(Boolean).join(" – ") || "-",
        )}</td></tr>`,
    )
    .join("\n");

  const team = library.teamMembers
    .map(
      (member) =>
        `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.position)}</td><td>${
          member.yearsExperience ?? "-"
        }</td><td>${escapeHtml(member.education ?? "-")}</td><td>${escapeHtml(
          (member.certifications ?? []).map((key) => CERTIFICATIONS[key]?.label ?? key).join(", ") || "-",
        )}</td></tr>`,
    )
    .join("\n");

  const certificates = library.certificates
    .map(
      (record) =>
        `<tr><td>${escapeHtml(record.name)}</td><td>${escapeHtml(record.issuer ?? "-")}</td><td>${escapeHtml(
          record.expiresAt ?? "ไม่ระบุ",
        )}</td><td>${record.verifyUrl ? escapeHtml(record.verifyUrl) : "-"}</td></tr>`,
    )
    .join("\n");

  const skippedNote = skipped.length
    ? `<p class="warn">ไฟล์ต่อไปนี้ไม่ได้รวมไว้เพราะชุดเอกสารใหญ่เกินกำหนด ดาวน์โหลดได้จากคลังเอกสาร: ${skipped
        .map((file) => escapeHtml(file.path))
        .join(", ")}</p>`
    : "";

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${escapeHtml(tor.title)} — รายการตรวจความพร้อม</title>
<style>
body{font-family:system-ui,"Sarabun","Noto Sans Thai",sans-serif;margin:32px;color:#1a1a1a;line-height:1.5}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}
table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #ccc;padding:6px 8px;vertical-align:top;text-align:left}
th{background:#f3f3f3}tr.ready td:nth-child(3){background:#eef8f0}tr.partial td:nth-child(3){background:#fff8e6}
tr.missing td:nth-child(3){background:#fdecec}small{color:#555}ul{margin:4px 0 0;padding-left:18px}.warn{color:#9a5b00}
.summary{font-size:16px;margin:12px 0}
</style>
</head>
<body>
<h1>${escapeHtml(tor.title)}</h1>
<div>${escapeHtml(tor.agency)}${tor.projectNumber ? ` · เลขที่โครงการ ${escapeHtml(tor.projectNumber)}` : ""}</div>
${tor.sourceUrl && /^https?:\/\//i.test(tor.sourceUrl) ? `<div><a href="${escapeHtml(tor.sourceUrl)}">${escapeHtml(tor.sourceUrl)}</a></div>` : ""}
<p class="summary">พร้อม <strong>${coverage.ready} จาก ${coverage.total}</strong> ข้อ · บางส่วน ${coverage.partial} · ยังไม่มี ${
    coverage.missing
  } · เตรียมเอง ${coverage.manual}</p>
<p><small>สร้างจากคลังเอกสารของบริษัทใน TorFinder เมื่อ ${escapeHtml(generatedAt)} — ตรวจกับเอกสารประกวดราคาฉบับจริงก่อนยื่นทุกครั้ง</small></p>
${skippedNote}
<h2>คุณสมบัติผู้ยื่นข้อเสนอ</h2>
<table><tr><th>#</th><th>ข้อกำหนดใน TOR</th><th>สถานะและหลักฐาน</th></tr>
${rows || '<tr><td colspan="3">TOR นี้ยังไม่มีรายการคุณสมบัติที่อ่านได้</td></tr>'}
</table>
<h2>ผลงานในคลัง</h2>
<table><tr><th>โครงการ</th><th>ผู้ว่าจ้าง</th><th>มูลค่า</th><th>ระยะเวลา</th></tr>
${projects || '<tr><td colspan="4">-</td></tr>'}
</table>
<h2>บุคลากรในคลัง</h2>
<table><tr><th>ชื่อ</th><th>ตำแหน่ง</th><th>ประสบการณ์ (ปี)</th><th>วุฒิการศึกษา</th><th>ใบรับรอง</th></tr>
${team || '<tr><td colspan="5">-</td></tr>'}
</table>
<h2>ใบรับรองของบริษัท</h2>
<table><tr><th>ใบรับรอง</th><th>ผู้ออก</th><th>หมดอายุ</th><th>ลิงก์ตรวจสอบ</th></tr>
${certificates || '<tr><td colspan="4">-</td></tr>'}
</table>
</body>
</html>
`;
}
