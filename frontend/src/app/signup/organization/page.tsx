"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { COMPANY_SIZE_OPTIONS, type CompanySize } from "@/data/company-profile";

export default function OrganizationSignupPage() {
  const t = useTranslations("SignupOrganizationPage");
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [size, setSize] = useState<CompanySize>(COMPANY_SIZE_OPTIONS[0]);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = companyName.trim() || t("defaultCompanyName");
    router.push(`/signup/pending?name=${encodeURIComponent(name)}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-alt px-6 py-12">
      <div className="w-full max-w-2xl">
        <Link href="/" className="mb-10 flex items-center justify-center gap-2.5">
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent text-base font-bold text-white">
            T
          </span>
          <span className="text-xl font-bold tracking-tight text-ink">TorFinder</span>
        </Link>

        <div className="rounded-2xl border border-border bg-white p-10">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent-text">
            <Building2 size={15} />
            {t("badge")}
          </span>
          <h1 className="text-2xl font-bold text-ink">{t("title")}</h1>
          <p className="mt-1.5 text-base text-ink-muted">
            {t("description")}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <p className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
              {t("accountInfoHeading")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">{t("companyEmailLabel")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">{t("passwordLabel")}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
            </div>

            <p className="pt-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
              {t("companyInfoHeading")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">{t("companyNameLabel")}</span>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t("companyNamePlaceholder")}
                  className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">
                  {t("taxIdLabel")}
                </span>
                <input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder={t("taxIdPlaceholder")}
                  className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">{t("contactNameLabel")}</span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder={t("contactNamePlaceholder")}
                  className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">{t("phoneLabel")}</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">{t("specialtyLabel")}</span>
                <input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder={t("specialtyPlaceholder")}
                  className="h-12 w-full rounded-lg border border-border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">{t("companySizeLabel")}</span>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value as CompanySize)}
                  className="h-12 w-full rounded-lg border border-border bg-white px-4 text-base text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                >
                  {COMPANY_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">{t("addressLabel")}</span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("addressPlaceholder")}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border px-4 py-3 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
            </div>

            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark"
            >
              {t("submitLabel")}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {t("hasAccountQuestion")}{" "}
          <Link href="/login/organization" className="font-medium text-accent hover:text-accent-dark">
            {t("loginLinkLabel")}
          </Link>
        </p>
      </div>
    </main>
  );
}
