"use client";

import { AlertCircle, Check, Download, ExternalLink, FileText, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type KeyboardEvent, useEffect, useState } from "react";

import { STANDARD_GROUPS, type CertificateRecord, type Certification, type StandardGroup } from "@/types/tor";
import { OffsiteLink } from "@/components/ui/offsite-link";

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

/** Matches the backend's cap; checked here too so a big scan fails before it uploads. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_ACCEPT = "application/pdf,image/png,image/jpeg";
/** How far ahead an expiry is worth flagging: a renewal audit takes about this long to book. */
const EXPIRING_DAYS = 90;

const GROUPS = Object.entries(STANDARD_GROUPS) as [StandardGroup, (typeof STANDARD_GROUPS)[StandardGroup]][];
const LABELS = new Map<string, string>(GROUPS.flatMap(([, standards]) => standards.map(({ id, label }) => [id, label])));

type Draft = {
  name: string;
  standard: Certification | "";
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  verifyUrl: string;
  scope: string;
};

const EMPTY: Draft = { name: "", standard: "", issuer: "", issuedAt: "", expiresAt: "", verifyUrl: "", scope: "" };

function draftOf(record: CertificateRecord): Draft {
  return {
    name: record.name,
    standard: record.standard ?? "",
    issuer: record.issuer ?? "",
    issuedAt: record.issuedAt ?? "",
    expiresAt: record.expiresAt ?? "",
    verifyUrl: record.verifyUrl ?? "",
    scope: record.scope ?? "",
  };
}

/** Today in Bangkok as YYYY-MM-DD — the backend decides expiry by the same clock. */
function bangkokToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

type Validity = "valid" | "expiring" | "expired" | "noExpiry";

function validityOf(record: CertificateRecord, today: string): Validity {
  if (!record.expiresAt) return "noExpiry";
  if (record.expiresAt < today) return "expired";
  return daysBetween(today, record.expiresAt) <= EXPIRING_DAYS ? "expiring" : "valid";
}

const VALIDITY_STYLE: Record<Validity, string> = {
  valid: "bg-success/10 text-success",
  expiring: "bg-warn/10 text-warn",
  expired: "bg-danger/10 text-danger",
  noExpiry: "bg-surface-alt text-ink-muted",
};

async function messageOf(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return typeof message === "string" && message ? message : fallback;
}

/** Enter in a field must not submit the profile form this section sits inside. */
function stayInSection(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.preventDefault();
}

type Props = {
  /** Told whenever the list changes, so the profile's completeness can count it. */
  onChange?: (certificates: CertificateRecord[] | null) => void;
};

/**
 * A company's certificates as records (#260): who issued each one, when, until
 * when, where an agency can check it, what it covers, and the scan itself.
 * Saved one at a time through their own endpoints, apart from the profile
 * form, because a file can only be attached to a record that already exists.
 */
export function CertificatesSection({ onChange }: Props) {
  const t = useTranslations("Certificates");
  const tOptions = useTranslations("CompanyProfileOptions");
  const locale = useLocale();

  const [certificates, setCertificates] = useState<CertificateRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  /** "new", a record id, or null when no form is open. */
  const [editing, setEditing] = useState<string | null>(null);

  function apply(next: CertificateRecord[] | null) {
    setCertificates(next);
    onChange?.(next);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/certificates", { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      if (res?.ok) {
        const data = (await res.json()) as { certificates: CertificateRecord[] | null };
        setCertificates(data.certificates);
        onChange?.(data.certificates);
      } else {
        setLoadFailed(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // `onChange` is the profile page's state setter, stable for its lifetime: this loads once.
  }, [onChange]);

  const today = bangkokToday();
  const dateFormat = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  const formatDate = (date: string) => dateFormat.format(new Date(`${date}T00:00:00Z`));

  async function answerNone() {
    const res = await fetch("/api/certificates/none", { method: "POST" });
    if (res.ok) apply(((await res.json()) as { certificates: CertificateRecord[] }).certificates);
  }

  async function remove(record: CertificateRecord) {
    if (!window.confirm(t("deleteConfirm", { name: record.name }))) return;
    const res = await fetch(`/api/certificates/${encodeURIComponent(record.id)}`, { method: "DELETE" });
    if (res.ok) apply((certificates ?? []).filter((item) => item.id !== record.id));
  }

  /** `done` false: the record is saved but its file isn't yet, so the form stays open to retry. */
  function saved(record: CertificateRecord, done = true) {
    const list = certificates ?? [];
    apply(list.some((item) => item.id === record.id) ? list.map((item) => (item.id === record.id ? record : item)) : [...list, record]);
    if (done) setEditing(null);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm text-ink-muted">{t("loading")}</p>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle size={14} />
          {t("loadFailed")}
        </p>
      </div>
    );
  }

  const list = certificates ?? [];
  const answeredNone = certificates !== null && list.length === 0;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <p className="text-sm text-ink-muted">{t("description")}</p>

      {list.length > 0 && (
        <ul className="space-y-3">
          {list.map((record) =>
            editing === record.id ? (
              <li key={record.id}>
                <CertificateForm record={record} onSaved={saved} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={record.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-ink">{record.name}</p>
                    {record.issuer && <p className="mt-0.5 text-sm text-ink-muted">{t("issuedBy", { issuer: record.issuer })}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${VALIDITY_STYLE[validityOf(record, today)]}`}
                  >
                    {t(`validity_${validityOf(record, today)}`)}
                  </span>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {(record.issuedAt || record.expiresAt) && (
                    <div className="flex gap-2">
                      <dt className="text-ink-subtle">{t("datesLabel")}</dt>
                      <dd className="text-ink">
                        {record.issuedAt ? formatDate(record.issuedAt) : "—"} – {record.expiresAt ? formatDate(record.expiresAt) : t("noExpiryShort")}
                      </dd>
                    </div>
                  )}
                  {record.standard && (
                    <div className="flex gap-2">
                      <dt className="text-ink-subtle">{t("matchesLabel")}</dt>
                      <dd className="font-mono text-ink">
                        {record.standard === "dealer" ? tOptions("cert_dealer") : LABELS.get(record.standard)}
                      </dd>
                    </div>
                  )}
                </dl>

                {record.scope && (
                  <p className="mt-2 whitespace-pre-line break-words text-sm text-ink-muted">
                    <span className="text-ink-subtle">{t("scopeLabel")}: </span>
                    {record.scope}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {record.verifyUrl && (
                    <OffsiteLink
                      href={record.verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-medium text-accent-text underline-offset-4 hover:underline"
                    >
                      <ExternalLink size={13} />
                      {t("verifyLink")}
                    </OffsiteLink>
                  )}
                  {record.file && (
                    <a
                      href={`/api/certificates/${encodeURIComponent(record.id)}/file`}
                      download={record.file.name}
                      className="flex min-w-0 items-center gap-1 font-medium text-accent-text underline-offset-4 hover:underline"
                    >
                      <Download size={13} className="shrink-0" />
                      <span className="truncate">{record.file.name}</span>
                    </a>
                  )}
                  {!record.verifyUrl && !record.file && (
                    <span className="flex items-center gap-1 text-xs text-warn">
                      <AlertCircle size={12} />
                      {t("unverifiable")}
                    </span>
                  )}
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => setEditing(record.id)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
                    >
                      <Pencil size={13} />
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(record)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={13} />
                      {t("delete")}
                    </button>
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      {editing === "new" ? (
        <CertificateForm onSaved={saved} onCancel={() => setEditing(null)} />
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <Plus size={14} />
            {t("add")}
          </button>
          {list.length === 0 && (
            <button
              type="button"
              onClick={answerNone}
              aria-pressed={answeredNone}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                answeredNone ? "bg-accent-soft text-accent-text" : "border border-border text-ink-muted hover:text-ink"
              }`}
            >
              {answeredNone && <Check size={13} />}
              {t("none")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type FormProps = {
  record?: CertificateRecord;
  onSaved: (record: CertificateRecord, done?: boolean) => void;
  onCancel: () => void;
};

/**
 * Not a <form>: it sits inside the profile's own form, and forms can't nest.
 * Saving writes the record first and then uploads the file, since the file
 * belongs to a record id.
 */
function CertificateForm({ record: initial, onSaved, onCancel }: FormProps) {
  const t = useTranslations("Certificates");
  const tOptions = useTranslations("CompanyProfileOptions");

  // Once saved, a new certificate is edited from then on — a retry after a
  // failed upload must update it, not create a second one.
  const [record, setRecord] = useState(initial);

  const [draft, setDraft] = useState<Draft>(initial ? draftOf(initial) : EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** Picking a known standard names the certificate after it, unless a name is already typed. */
  function pickStandard(standard: Certification | "") {
    setDraft((current) => ({
      ...current,
      standard,
      name:
        current.name.trim() || !standard
          ? current.name
          : standard === "dealer"
            ? tOptions("cert_dealer")
            : (LABELS.get(standard) ?? current.name),
    }));
  }

  function pickFile(next: File | null) {
    setError(null);
    if (next && next.size > MAX_FILE_BYTES) {
      setError(t("fileTooLarge"));
      return;
    }
    setFile(next);
    if (next) setRemoveFile(false);
  }

  const datesBackwards = Boolean(draft.issuedAt && draft.expiresAt && draft.expiresAt < draft.issuedAt);

  async function save() {
    if (!draft.name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);

    const body = { ...draft, standard: draft.standard || undefined };
    const res = await fetch(record ? `/api/certificates/${encodeURIComponent(record.id)}` : "/api/certificates", {
      method: record ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError(await messageOf(res, t("saveFailed")));
      setSaving(false);
      return;
    }
    let saved = (await res.json()) as CertificateRecord;
    setRecord(saved);
    const fileUrl = `/api/certificates/${encodeURIComponent(saved.id)}/file`;

    if (file) {
      const form = new FormData();
      form.append("file", file);
      const upload = await fetch(fileUrl, { method: "PUT", body: form });
      if (!upload.ok) {
        // The record is saved either way; keep the form open on it so the file can be retried.
        setError(await messageOf(upload, t("uploadFailed")));
        setSaving(false);
        onSaved(saved, false);
        return;
      }
      saved = (await upload.json()) as CertificateRecord;
    } else if (removeFile && saved.file) {
      const removed = await fetch(fileUrl, { method: "DELETE" });
      if (removed.ok) saved = (await removed.json()) as CertificateRecord;
    }

    setSaving(false);
    onSaved(saved);
  }

  const currentFile = record?.file && !removeFile && !file ? record.file : null;

  return (
    <div className="space-y-4 rounded-lg border border-accent/30 bg-surface-alt/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("standardLabel")}</span>
          <select
            value={draft.standard}
            onChange={(event) => pickStandard(event.target.value as Certification | "")}
            className={inputCls}
          >
            <option value="">{t("standardNone")}</option>
            {GROUPS.map(([group, standards]) => (
              <optgroup key={group} label={tOptions(`standardGroup_${group}`)}>
                {standards.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label={t("otherGroup")}>
              <option value="dealer">{tOptions("cert_dealer")}</option>
            </optgroup>
          </select>
          <span className="mt-1.5 block text-xs text-ink-subtle">{t("standardHint")}</span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("nameLabel")}</span>
          <input
            value={draft.name}
            onChange={(event) => set("name", event.target.value)}
            onKeyDown={stayInSection}
            maxLength={200}
            placeholder="ISO/IEC 27001:2022"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("issuerLabel")}</span>
          <input
            value={draft.issuer}
            onChange={(event) => set("issuer", event.target.value)}
            onKeyDown={stayInSection}
            maxLength={200}
            placeholder={t("issuerPlaceholder")}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("issuedAtLabel")}</span>
          <input
            type="date"
            value={draft.issuedAt}
            onChange={(event) => set("issuedAt", event.target.value)}
            onKeyDown={stayInSection}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("expiresAtLabel")}</span>
          <input
            type="date"
            value={draft.expiresAt}
            min={draft.issuedAt || undefined}
            onChange={(event) => set("expiresAt", event.target.value)}
            onKeyDown={stayInSection}
            className={inputCls}
          />
          <span className="mt-1.5 block text-xs text-ink-subtle">{t("expiresAtHint")}</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("verifyUrlLabel")}</span>
          <input
            type="url"
            inputMode="url"
            value={draft.verifyUrl}
            onChange={(event) => set("verifyUrl", event.target.value)}
            onKeyDown={stayInSection}
            maxLength={500}
            placeholder="https://"
            className={inputCls}
          />
          <span className="mt-1.5 block text-xs text-ink-subtle">{t("verifyUrlHint")}</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("scopeLabel")}</span>
          <textarea
            value={draft.scope}
            onChange={(event) => set("scope", event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t("scopePlaceholder")}
            className={`${inputCls} resize-none`}
          />
        </label>

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink">{t("fileLabel")}</span>
          {currentFile ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 text-ink">
                <FileText size={14} className="shrink-0 text-ink-subtle" />
                <span className="truncate">{currentFile.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setRemoveFile(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-muted hover:bg-danger/10 hover:text-danger"
              >
                <X size={13} />
                {t("removeFile")}
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-ink-muted hover:border-ink-subtle hover:text-ink">
              <Paperclip size={14} className="shrink-0" />
              <span className="truncate">{file ? file.name : t("filePick")}</span>
              <input
                type="file"
                accept={FILE_ACCEPT}
                onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
                className="sr-only"
              />
            </label>
          )}
          <span className="mt-1.5 block text-xs text-ink-subtle">{t("fileHint")}</span>
        </div>
      </div>

      {(error || datesBackwards) && (
        <p role="alert" className="flex items-start gap-1 text-sm text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error ?? t("datesBackwards")}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted hover:text-ink"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || datesBackwards}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
