"use client";

import { AlertCircle, Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { PageBody, PageHeader, Section } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { RecordSection, inputCls, stayInForm } from "@/components/library/record-section";
import { CertificatesSection } from "@/components/profile/certificates-section";
import {
  CLIENT_TYPES,
  PERSONAL_CERTIFICATIONS,
  type ClientType,
  type PastProject,
  type TeamMember,
} from "@/types/library";
import { WORK_TYPE_GROUPS, type WorkType } from "@/types/tor";

type ProjectDraft = {
  title: string;
  client: string;
  clientType: ClientType | "";
  value: string;
  startedAt: string;
  completedAt: string;
  workTypes: WorkType[];
  description: string;
};

type MemberDraft = {
  name: string;
  position: string;
  yearsExperience: string;
  education: string;
  certifications: string[];
  skills: string;
};

const digits = (text: string) => text.replace(/[^\d]/g, "");
const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? "bg-accent-soft text-accent-text" : "border border-border text-ink-muted hover:text-ink"
      }`}
    >
      {active && <Check size={12} />}
      {children}
    </button>
  );
}

/**
 * The proposal library (#259): the pieces every bid repeats — past projects,
 * the team and its CVs, and certificates — kept once per company so a TOR
 * page can say how much of a bid is already ready.
 */
export default function LibraryPage() {
  const t = useTranslations("Library");
  const tOptions = useTranslations("CompanyProfileOptions");
  const locale = useLocale();

  const [projects, setProjects] = useState<PastProject[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/library", { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      if (res?.ok) {
        const data = (await res.json()) as { pastProjects: PastProject[]; teamMembers: TeamMember[] };
        setProjects(data.pastProjects);
        setTeam(data.teamMembers);
      } else {
        setFailed(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const baht = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US");
  const dateFormat = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeZone: "UTC" });
  const formatDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));
  const certLabel = new Map<string, string>(PERSONAL_CERTIFICATIONS.map(({ id, label }) => [id, label]));

  return (
    <AppShell>
      <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
      <PageBody>
        {loading ? (
          <p className="text-sm text-ink-muted">{t("loading")}</p>
        ) : failed ? (
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <AlertCircle size={14} />
            {t("loadFailed")}
          </p>
        ) : (
          <div className="space-y-8">
            {/* Projects and team side by side on a wide screen; certificates span the width below. */}
            <div className="grid items-start gap-8 xl:grid-cols-2">
            <Section id="projects" title={t("projectsTitle")}>
              <RecordSection<PastProject, ProjectDraft>
                kind="projects"
                records={projects}
                onChange={setProjects}
                empty={t("projectsEmpty")}
                addLabel={t("projectsAdd")}
                fileLabel={t("projectFileLabel")}
                nameOf={(project) => project.title}
                draftOf={(project) => ({
                  title: project?.title ?? "",
                  client: project?.client ?? "",
                  clientType: project?.clientType ?? "",
                  value: project?.value ? String(project.value) : "",
                  startedAt: project?.startedAt ?? "",
                  completedAt: project?.completedAt ?? "",
                  workTypes: project?.workTypes ?? [],
                  description: project?.description ?? "",
                })}
                bodyOf={(draft) => ({
                  ...draft,
                  clientType: draft.clientType || undefined,
                  value: draft.value ? Number(draft.value) : undefined,
                })}
                missingOf={(draft) => (draft.title.trim() ? null : t("projectTitleRequired"))}
                problemOf={(draft) =>
                  draft.startedAt && draft.completedAt && draft.completedAt < draft.startedAt ? t("datesBackwards") : null
                }
                renderCard={(project) => (
                  <>
                    <p className="break-words text-sm font-semibold text-ink">{project.title}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {[
                        project.client,
                        project.clientType && t(`clientType_${project.clientType}`),
                        project.value && `฿${baht.format(project.value)}`,
                        (project.startedAt || project.completedAt) &&
                          `${project.startedAt ? formatDate(project.startedAt) : "—"} – ${
                            project.completedAt ? formatDate(project.completedAt) : t("ongoing")
                          }`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {project.workTypes?.length ? (
                      <p className="mt-1 text-xs text-ink-subtle">
                        {project.workTypes.map((type) => tOptions(`workType_${type}`)).join(" · ")}
                      </p>
                    ) : null}
                    {project.description && (
                      <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-muted">{project.description}</p>
                    )}
                  </>
                )}
                renderFields={(draft, set) => (
                  <>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("projectTitleLabel")}</span>
                      <input value={draft.title} onChange={(e) => set("title", e.target.value)} onKeyDown={stayInForm} maxLength={300} className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("clientLabel")}</span>
                      <input value={draft.client} onChange={(e) => set("client", e.target.value)} onKeyDown={stayInForm} maxLength={200} className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("clientTypeLabel")}</span>
                      <select value={draft.clientType} onChange={(e) => set("clientType", e.target.value as ClientType | "")} className={inputCls}>
                        <option value="">{t("clientTypeNone")}</option>
                        {CLIENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(`clientType_${type}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("valueLabel")}</span>
                      <input
                        value={draft.value ? baht.format(Number(draft.value)) : ""}
                        onChange={(e) => set("value", digits(e.target.value))}
                        onKeyDown={stayInForm}
                        inputMode="numeric"
                        placeholder="3,500,000"
                        className={inputCls}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink">{t("startedAtLabel")}</span>
                        <input type="date" value={draft.startedAt} onChange={(e) => set("startedAt", e.target.value)} onKeyDown={stayInForm} className={inputCls} />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-ink">{t("completedAtLabel")}</span>
                        <input
                          type="date"
                          value={draft.completedAt}
                          min={draft.startedAt || undefined}
                          onChange={(e) => set("completedAt", e.target.value)}
                          onKeyDown={stayInForm}
                          className={inputCls}
                        />
                      </label>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("workTypesLabel")}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.values(WORK_TYPE_GROUPS)
                          .flat()
                          .map((type) => (
                            <Chip key={type} active={draft.workTypes.includes(type)} onClick={() => set("workTypes", toggle(draft.workTypes, type))}>
                              {tOptions(`workType_${type}`)}
                            </Chip>
                          ))}
                      </div>
                    </div>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("descriptionLabel")}</span>
                      <textarea
                        value={draft.description}
                        onChange={(e) => set("description", e.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder={t("descriptionPlaceholder")}
                        className={`${inputCls} resize-none`}
                      />
                    </label>
                  </>
                )}
              />
            </Section>

            <Section id="team" title={t("teamTitle")}>
              <RecordSection<TeamMember, MemberDraft>
                kind="team"
                records={team}
                onChange={setTeam}
                empty={t("teamEmpty")}
                addLabel={t("teamAdd")}
                fileLabel={t("cvLabel")}
                nameOf={(member) => member.name}
                draftOf={(member) => ({
                  name: member?.name ?? "",
                  position: member?.position ?? "",
                  yearsExperience: member?.yearsExperience !== undefined ? String(member.yearsExperience) : "",
                  education: member?.education ?? "",
                  certifications: member?.certifications ?? [],
                  skills: member?.skills ?? "",
                })}
                bodyOf={(draft) => ({
                  ...draft,
                  yearsExperience: draft.yearsExperience ? Number(draft.yearsExperience) : undefined,
                })}
                missingOf={(draft) =>
                  !draft.name.trim() ? t("memberNameRequired") : !draft.position.trim() ? t("positionRequired") : null
                }
                problemOf={() => null}
                renderCard={(member) => (
                  <>
                    <p className="break-words text-sm font-semibold text-ink">{member.name}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {[
                        member.position,
                        member.yearsExperience !== undefined && t("yearsShort", { years: member.yearsExperience }),
                        member.education,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {member.certifications?.length ? (
                      <p className="mt-1 font-mono text-xs text-ink-subtle">
                        {member.certifications.map((key) => certLabel.get(key) ?? key).join(" · ")}
                      </p>
                    ) : null}
                    {member.skills && <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-muted">{member.skills}</p>}
                  </>
                )}
                renderFields={(draft, set) => (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("memberNameLabel")}</span>
                      <input value={draft.name} onChange={(e) => set("name", e.target.value)} onKeyDown={stayInForm} maxLength={200} className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("positionLabel")}</span>
                      <input
                        value={draft.position}
                        onChange={(e) => set("position", e.target.value)}
                        onKeyDown={stayInForm}
                        maxLength={200}
                        placeholder={t("positionPlaceholder")}
                        className={inputCls}
                      />
                      <span className="mt-1.5 block text-xs text-ink-subtle">{t("positionHint")}</span>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("yearsLabel")}</span>
                      <input
                        value={draft.yearsExperience}
                        onChange={(e) => set("yearsExperience", digits(e.target.value).slice(0, 2))}
                        onKeyDown={stayInForm}
                        inputMode="numeric"
                        className={inputCls}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("educationLabel")}</span>
                      <input
                        value={draft.education}
                        onChange={(e) => set("education", e.target.value)}
                        onKeyDown={stayInForm}
                        maxLength={300}
                        placeholder={t("educationPlaceholder")}
                        className={inputCls}
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("personalCertsLabel")}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {PERSONAL_CERTIFICATIONS.map(({ id, label }) => (
                          <Chip key={id} active={draft.certifications.includes(id)} onClick={() => set("certifications", toggle(draft.certifications, id))}>
                            {label}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-sm font-medium text-ink">{t("skillsLabel")}</span>
                      <textarea
                        value={draft.skills}
                        onChange={(e) => set("skills", e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder={t("skillsPlaceholder")}
                        className={`${inputCls} resize-none`}
                      />
                    </label>
                  </>
                )}
              />
            </Section>
            </div>

            <Section id="certificates" title={t("certificatesTitle")}>
              <CertificatesSection />
            </Section>
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
