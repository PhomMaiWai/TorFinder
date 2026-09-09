"use client";

import { AlertCircle, ArrowLeft, Building2, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordInput } from "@/components/ui/password-input";
import { COMPANY_SIZE_OPTIONS } from "@/data/company-profile";
import {
  digitsOnly,
  formatPhone,
  formatTaxId,
  hasValidTaxIdChecksum,
  isValidPhone,
  isValidTaxId,
} from "@/lib/thai-validation";

import { signupOrganization } from "./actions";

const inputCls =
  "h-12 w-full rounded-lg border px-4 text-base text-ink outline-none placeholder:text-ink-subtle focus:ring-2 focus:ring-accent/10";

/** Every field the backend requires, so the progress count matches reality. */
const REQUIRED_FIELDS = [
  "email",
  "password",
  "confirmPassword",
  "companyName",
  "taxId",
  "contactName",
  "phone",
] as const;

type FieldName = (typeof REQUIRED_FIELDS)[number];
type Values = Record<FieldName, string>;

const EMPTY: Values = {
  email: "",
  password: "",
  confirmPassword: "",
  companyName: "",
  taxId: "",
  contactName: "",
  phone: "",
};

function validate(values: Values, t: (key: string) => string): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = t("errorEmail");
  }
  if (values.password && values.password.length < 8) {
    errors.password = t("errorPasswordLength");
  }
  if (values.confirmPassword && values.confirmPassword !== values.password) {
    errors.confirmPassword = t("errorPasswordMismatch");
  }
  if (values.taxId && !isValidTaxId(values.taxId)) {
    errors.taxId = t("errorTaxIdLength");
  }
  if (values.phone && !isValidPhone(values.phone)) {
    errors.phone = t("errorPhone");
  }
  return errors;
}

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="flex h-12 w-full items-center justify-center rounded-lg bg-accent text-base font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

export default function OrganizationSignupPage() {
  const t = useTranslations("SignupOrganizationPage");
  const tc = useTranslations("Common");
  const [state, formAction] = useActionState(signupOrganization, {});
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  const errors = validate(values, t);
  // Advisory only: a failed check digit is usually a typo, but not always.
  const taxIdWarning =
    isValidTaxId(values.taxId) && !hasValidTaxIdChecksum(values.taxId)
      ? t("warnTaxIdChecksum")
      : undefined;
  const filledCount = REQUIRED_FIELDS.filter((field) => values[field].trim()).length;
  const isComplete = filledCount === REQUIRED_FIELDS.length && Object.keys(errors).length === 0;

  function set(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function errorFor(field: FieldName) {
    return touched[field] ? errors[field] : undefined;
  }

  function fieldCls(field: FieldName) {
    return errorFor(field)
      ? `${inputCls} border-danger focus:border-danger`
      : `${inputCls} border-border focus:border-accent/40`;
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
          <p className="mt-1.5 text-base text-ink-muted">{t("description")}</p>

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

          <form action={formAction} className="mt-6 space-y-5" noValidate>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("accountInfoHeading")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("companyEmailLabel")} error={errorFor("email")}>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="contact@company.com"
                  value={values.email}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={() => setTouched((c) => ({ ...c, email: true }))}
                  className={fieldCls("email")}
                />
              </Field>
              <div className="sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4">
                <Field label={t("passwordLabel")} error={errorFor("password")}>
                  <PasswordInput
                    name="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={values.password}
                    onChange={(e) => set("password", e.target.value)}
                    onBlur={() => setTouched((c) => ({ ...c, password: true }))}
                    showLabel={tc("showPassword")}
                    hideLabel={tc("hidePassword")}
                    className={errorFor("password") ? "border-danger" : ""}
                    aria-invalid={!!errorFor("password")}
                  />
                </Field>
                <Field label={t("confirmPasswordLabel")} error={errorFor("confirmPassword")}>
                  <PasswordInput
                    name="confirmPassword"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={values.confirmPassword}
                    onChange={(e) => set("confirmPassword", e.target.value)}
                    onBlur={() => setTouched((c) => ({ ...c, confirmPassword: true }))}
                    showLabel={tc("showPassword")}
                    hideLabel={tc("hidePassword")}
                    className={errorFor("confirmPassword") ? "border-danger" : ""}
                    aria-invalid={!!errorFor("confirmPassword")}
                  />
                </Field>
              </div>
            </div>

            <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
              {t("companyInfoHeading")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("companyNameLabel")} error={errorFor("companyName")}>
                <input
                  name="companyName"
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
                  name="taxId"
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
                  name="contactName"
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
                  name="phone"
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
                  name="specialty"
                  placeholder={t("specialtyPlaceholder")}
                  className={`${inputCls} border-border focus:border-accent/40`}
                />
              </Field>
              <Field label={t("companySizeLabel")}>
                <select
                  name="size"
                  defaultValue={COMPANY_SIZE_OPTIONS[0]}
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
                    name="address"
                    rows={2}
                    placeholder={t("addressPlaceholder")}
                    className="w-full resize-none rounded-lg border border-border px-4 py-3 text-base text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                  />
                </Field>
              </div>
            </div>

            {state.error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-danger-soft px-4 py-3 text-sm font-medium text-danger"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {state.error}
              </p>
            )}

            <SubmitButton label={t("submitLabel")} disabled={!isComplete} />
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-muted">
          {t("hasAccountQuestion")}{" "}
          <Link
            href="/login/organization"
            className="font-medium text-accent hover:text-accent-dark"
          >
            {t("loginLinkLabel")}
          </Link>
        </p>
        <Link
          href="/"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          {tc("backToHome")}
        </Link>
      </div>
    </main>
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
