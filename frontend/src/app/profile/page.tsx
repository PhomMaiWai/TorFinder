"use client";

import { AlertCircle, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { type SubmitEvent, useEffect, useState } from "react";

import { PageBody, PageHeader, Section } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import { COMPANY_SIZE_OPTIONS, TECH_STACK_OPTIONS, type CompanySize } from "@/data/company-profile";
import { formatTaxId, hasValidTaxIdChecksum, isValidTaxId } from "@/lib/thai-validation";

const readOnlyInputCls =
  "w-full rounded-lg border border-border bg-surface-alt px-3 py-2 text-sm text-ink-muted outline-none";
const inputCls =
  "w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

type Account = {
  email: string;
  company?: {
    companyName?: string;
    taxId?: string;
    contactName?: string;
    phone?: string;
    address?: string;
    specialty?: string;
    size?: string;
    techStack?: string[];
    pastExperience?: string;
  };
};

async function fetchAccountProfile(): Promise<Account | null> {
  const res = await fetch("/api/accounts/me", { cache: "no-store" });
  return res.ok ? res.json() : null;
}

export default function ProfilePage() {
  const t = useTranslations("ProfilePage");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [size, setSize] = useState<CompanySize>(COMPANY_SIZE_OPTIONS[0]);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [pastExperience, setPastExperience] = useState("");
  const [touchedTaxId, setTouchedTaxId] = useState(false);

  // A Google sign-in never collects these, so they start blank on those
  // accounts — the backend allows filling in whichever is still blank, then
  // locks it. Whether each is locked is decided by what the server had at
  // load time, not by what's currently typed into the field.
  const [companyNameLocked, setCompanyNameLocked] = useState(true);
  const [taxIdLocked, setTaxIdLocked] = useState(true);

  function applyAccount(account: Account) {
    setCompanyName(account.company?.companyName ?? "");
    setTaxId(account.company?.taxId ?? "");
    setEmail(account.email ?? "");
    setContactName(account.company?.contactName ?? "");
    setPhone(account.company?.phone ?? "");
    setAddress(account.company?.address ?? "");
    setSpecialty(account.company?.specialty ?? "");
    setSize((account.company?.size as CompanySize) ?? COMPANY_SIZE_OPTIONS[0]);
    setTechStack(account.company?.techStack ?? []);
    setPastExperience(account.company?.pastExperience ?? "");
    setCompanyNameLocked(!!account.company?.companyName);
    setTaxIdLocked(!!account.company?.taxId);
  }

  useEffect(() => {
    async function load() {
      const account = await fetchAccountProfile();
      if (account) applyAccount(account);
      setLoading(false);
    }
    load();
  }, []);

  const percent = Math.round(
    (
      [
        contactName.trim(),
        phone.trim(),
        address.trim(),
        specialty.trim(),
        size,
        techStack.length > 0 ? "x" : "",
        pastExperience.trim(),
      ].filter(Boolean).length /
        7
    ) * 100,
  );

  const hasInvalidTaxId = !taxIdLocked && taxId.trim() !== "" && !isValidTaxId(taxId);

  function toggleTech(tag: string) {
    setTechStack((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(false);

    const res = await fetch("/api/accounts/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(companyNameLocked ? {} : { companyName }),
        ...(taxIdLocked ? {} : { taxId }),
        contactName,
        phone,
        address,
        specialty,
        size,
        techStack,
        pastExperience,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      setError(true);
      return;
    }
    // Re-fetch rather than trust local state: if companyName/taxId just got
    // filled in for the first time, the server has now locked them, and this
    // is what actually reflects that.
    const account = await fetchAccountProfile();
    if (account) applyAccount(account);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  if (loading) {
    return (
      <AppShell>
        <PageHeader title={t("pageTitle")} description={t("pageDescription")} />
        <PageBody>
          <p className="text-sm text-ink-muted">{t("loadingMessage")}</p>
        </PageBody>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageDescription")}
      />

      <PageBody>
        <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <Section title={t("accountInfoSectionTitle")}>
            <div className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("companyEmailLabel")}
                </span>
                <input type="email" value={email} readOnly disabled className={readOnlyInputCls} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("phoneLabel")}
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </Section>

          <Section title={t("companyInfoSectionTitle")}>
            <div className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("companyNameLabel")}
                </span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  readOnly={companyNameLocked}
                  disabled={companyNameLocked}
                  placeholder={companyNameLocked ? undefined : t("companyNameFillInPlaceholder")}
                  className={companyNameLocked ? readOnlyInputCls : inputCls}
                />
                {!companyNameLocked && (
                  <span className="mt-1.5 flex items-start gap-1 text-xs text-ink-subtle">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {t("fillOnceNotice")}
                  </span>
                )}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("taxIdLabel")}
                </span>
                <input
                  value={taxId}
                  onChange={(e) => setTaxId(taxIdLocked ? taxId : formatTaxId(e.target.value))}
                  onBlur={() => setTouchedTaxId(true)}
                  readOnly={taxIdLocked}
                  disabled={taxIdLocked}
                  inputMode={taxIdLocked ? undefined : "numeric"}
                  placeholder={taxIdLocked ? undefined : t("taxIdPlaceholder")}
                  className={
                    !taxIdLocked && touchedTaxId && !isValidTaxId(taxId)
                      ? `${inputCls} border-danger focus:border-danger`
                      : taxIdLocked
                        ? readOnlyInputCls
                        : inputCls
                  }
                />
                {!taxIdLocked && touchedTaxId && !isValidTaxId(taxId) && (
                  <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
                    <AlertCircle size={12} className="shrink-0" />
                    {t("errorTaxIdLength")}
                  </span>
                )}
                {!taxIdLocked && isValidTaxId(taxId) && !hasValidTaxIdChecksum(taxId) && (
                  <span className="mt-1.5 flex items-start gap-1 text-xs font-medium text-warn">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {t("warnTaxIdChecksum")}
                  </span>
                )}
                {!taxIdLocked && !(touchedTaxId && !isValidTaxId(taxId)) && (
                  <span className="mt-1.5 flex items-start gap-1 text-xs text-ink-subtle">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    {t("fillOnceNotice")}
                  </span>
                )}
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("contactNameLabel")}
                </span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("specialtyLabel")}
                </span>
                <input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("sizeLabel")}
                </span>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value as CompanySize)}
                  className={`${inputCls} bg-white`}
                >
                  {COMPANY_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  {t("addressLabel")}
                </span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </label>
            </div>
          </Section>

          <Section title="Tech Stack">
            <div className="rounded-xl border border-border bg-white p-5">
              <p className="mb-3 text-sm text-ink-muted">
                {t("techStackDescription")}
              </p>
              <div className="flex flex-wrap gap-2">
                {TECH_STACK_OPTIONS.map((tag) => {
                  const active = techStack.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTech(tag)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-accent-soft text-accent-text"
                          : "border border-border text-ink-muted hover:text-ink"
                      }`}
                    >
                      {active && <Check size={13} />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section title={t("pastExperienceSectionTitle")}>
            <div className="rounded-xl border border-border bg-white p-5">
              <p className="mb-3 text-sm text-ink-muted">{t("pastExperienceDescription")}</p>
              <textarea
                value={pastExperience}
                onChange={(e) => setPastExperience(e.target.value)}
                rows={4}
                placeholder={t("pastExperiencePlaceholder")}
                className={`${inputCls} resize-none`}
              />
            </div>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-white p-5 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent-soft text-lg font-bold text-accent-text">
              {companyName.trim().charAt(0) || "A"}
            </span>
            <p className="truncate text-sm font-semibold text-ink">
              {companyName.trim() || t("companyNameFallback")}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {specialty.trim() || t("specialtyFallback")}
            </p>

            <div className="mt-4 text-left">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-ink-muted">{t("profileCompletenessLabel")}</span>
                <span className="font-bold text-ink">{percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || hasInvalidTaxId}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("saveButton")}
          </button>
          {saved && (
            <p className="text-center text-sm font-medium text-success">{t("savedConfirmation")}</p>
          )}
          {error && (
            <p className="text-center text-sm font-medium text-danger">{t("saveErrorMessage")}</p>
          )}
        </aside>
        </form>
      </PageBody>
    </AppShell>
  );
}
