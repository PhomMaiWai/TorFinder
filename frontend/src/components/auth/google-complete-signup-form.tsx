"use client";

import { AlertCircle, Check, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { type SubmitEvent, useState } from "react";

import { COMPANY_SIZE_OPTIONS } from "@/data/company-profile";
import {
  digitsOnly,
  formatPhone,
  formatTaxId,
  hasValidTaxIdChecksum,
  isValidPhone,
  isValidTaxId,
} from "@/lib/thai-validation";

const inputCls =
  "h-12 w-full rounded-lg border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:ring-2 focus:ring-accent/10";

const REQUIRED_FIELDS = ["companyName", "taxId", "contactName", "phone"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];
type Values = Record<RequiredField, string> & { address: string; specialty: string; size: string };

const EMPTY: Values = {
  companyName: "",
  taxId: "",
  contactName: "",
  phone: "",
  address: "",
  specialty: "",
  size: COMPANY_SIZE_OPTIONS[0],
};

type GoogleCompleteSignupFormProps = {
  credential: string;
  email: string;
  /** A brand-new account with an approved company profile — the caller redirects to the pending screen. */
  onSubmitted: (companyName: string) => void;
  onCancel: () => void;
};

export function GoogleCompleteSignupForm({
  credential,
  email,
  onSubmitted,
  onCancel,
}: GoogleCompleteSignupFormProps) {
  const t = useTranslations("SignupOrganizationPage");
  const tg = useTranslations("GoogleCompleteSignupForm");
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<RequiredField, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors: Partial<Record<RequiredField, string>> = {};
  if (values.taxId && !isValidTaxId(values.taxId)) errors.taxId = t("errorTaxIdLength");
  if (values.phone && !isValidPhone(values.phone)) errors.phone = t("errorPhone");
  const taxIdWarning =
    isValidTaxId(values.taxId) && !hasValidTaxIdChecksum(values.taxId)
      ? t("warnTaxIdChecksum")
      : undefined;

  const filledCount = REQUIRED_FIELDS.filter((field) => values[field].trim()).length;
  const isComplete = filledCount === REQUIRED_FIELDS.length && Object.keys(errors).length === 0;

  function set(field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }
  function errorFor(field: RequiredField) {
    return touched[field] ? errors[field] : undefined;
  }
  function fieldCls(field: RequiredField) {
    return errorFor(field)
      ? `${inputCls} border-danger focus:border-danger`
      : `${inputCls} border-border focus:border-accent/40`;
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/google/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, ...values }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? tg("submitError"));
        return;
      }
      onSubmitted(values.companyName);
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent-text">
        <Sparkles size={15} />
        {tg("badge")}
      </span>
      <h1 className="text-2xl font-bold text-ink">{tg("title")}</h1>
      <p className="mt-1.5 text-base text-ink-muted">{tg("description")}</p>
      <p className="mt-3 text-sm font-medium text-ink">{tg("verifiedAs", { email })}</p>

      <div className="mt-6 rounded-lg bg-surface-alt px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className={isComplete ? "font-medium text-success" : "text-ink-muted"}>
            {isComplete
              ? t("progressComplete")
              : t("progressLabel", { done: filledCount, total: REQUIRED_FIELDS.length })}
          </span>
          {isComplete && <Check size={16} className="shrink-0 text-success" />}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
          <div
            className={`h-full rounded-full transition-all ${isComplete ? "bg-success" : "bg-accent"}`}
            style={{ width: `${(filledCount / REQUIRED_FIELDS.length) * 100}%` }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("companyNameLabel")} error={errorFor("companyName")}>
            <input
              placeholder={t("companyNamePlaceholder")}
              value={values.companyName}
              onChange={(e) => set("companyName", e.target.value)}
              onBlur={() => setTouched((c) => ({ ...c, companyName: true }))}
              className={fieldCls("companyName")}
            />
          </Field>
          <Field
            label={t("taxIdLabel")}
            error={errorFor("taxId")}
            hint={t("taxIdCounter", { count: digitsOnly(values.taxId).length })}
            hintDone={isValidTaxId(values.taxId)}
            warning={touched.taxId ? taxIdWarning : undefined}
          >
            <input
              inputMode="numeric"
              placeholder={t("taxIdPlaceholder")}
              value={values.taxId}
              onChange={(e) => set("taxId", formatTaxId(e.target.value))}
              onBlur={() => setTouched((c) => ({ ...c, taxId: true }))}
              className={fieldCls("taxId")}
            />
          </Field>
          <Field label={t("contactNameLabel")} error={errorFor("contactName")}>
            <input
              placeholder={t("contactNamePlaceholder")}
              value={values.contactName}
              onChange={(e) => set("contactName", e.target.value)}
              onBlur={() => setTouched((c) => ({ ...c, contactName: true }))}
              className={fieldCls("contactName")}
            />
          </Field>
          <Field
            label={t("phoneLabel")}
            error={errorFor("phone")}
            hint={t("phoneCounter", { count: digitsOnly(values.phone).length })}
            hintDone={isValidPhone(values.phone)}
          >
            <input
              inputMode="tel"
              placeholder="08X-XXX-XXXX"
              value={values.phone}
              onChange={(e) => set("phone", formatPhone(e.target.value))}
              onBlur={() => setTouched((c) => ({ ...c, phone: true }))}
              className={fieldCls("phone")}
            />
          </Field>
          <Field label={t("specialtyLabel")}>
            <input
              placeholder={t("specialtyPlaceholder")}
              value={values.specialty}
              onChange={(e) => set("specialty", e.target.value)}
              className={`${inputCls} border-border focus:border-accent/40`}
            />
          </Field>
          <Field label={t("companySizeLabel")}>
            <select
              value={values.size}
              onChange={(e) => set("size", e.target.value)}
              className={`${inputCls} border-border bg-white focus:border-accent/40`}
            >
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t("addressLabel")}>
              <textarea
                rows={2}
                placeholder={t("addressPlaceholder")}
                value={values.address}
                onChange={(e) => set("address", e.target.value)}
                className="w-full resize-none rounded-lg border border-border px-4 py-3 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
              />
            </Field>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!isComplete || isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {tg("submitLabel")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-full items-center justify-center text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {tg("cancelLabel")}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  error,
  warning,
  hint,
  hintDone,
  children,
}: {
  label: string;
  error?: string;
  warning?: string;
  hint?: string;
  hintDone?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint && (
          <span className={`text-xs ${hintDone ? "text-success" : "text-ink-subtle"}`}>{hint}</span>
        )}
      </span>
      {children}
      {error && (
        <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle size={12} className="shrink-0" />
          {error}
        </span>
      )}
      {!error && warning && (
        <span className="mt-1.5 flex items-start gap-1 text-xs font-medium text-warn">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {warning}
        </span>
      )}
    </label>
  );
}
