"use client";

import { AlertCircle, Download, FileText, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, type ReactNode, useState } from "react";

import type { LibraryFile, LibraryKind } from "@/types/library";

export const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

/** Matches the backend's cap; checked here too so a big file fails before it uploads. */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_ACCEPT =
  "application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx";

/** Enter in a field saves this record, never anything around it. */
export function stayInForm(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.preventDefault();
}

async function messageOf(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
  return typeof message === "string" && message ? message : fallback;
}

type WithFile = { id: string; file?: LibraryFile };

type Props<R extends WithFile, D> = {
  kind: LibraryKind;
  records: R[];
  onChange: (records: R[]) => void;
  empty: string;
  addLabel: string;
  fileLabel: string;
  /** Draft for a new record, or for editing `record`. */
  draftOf: (record?: R) => D;
  /** The JSON the backend expects for a draft. */
  bodyOf: (draft: D) => unknown;
  /** A field that must be filled, said when Save is pressed. */
  missingOf: (draft: D) => string | null;
  /** A contradiction between fields, said as soon as it appears. */
  problemOf: (draft: D) => string | null;
  renderCard: (record: R) => ReactNode;
  renderFields: (draft: D, set: <K extends keyof D>(key: K, value: D[K]) => void) => ReactNode;
  /** What a confirm dialog calls the record. */
  nameOf: (record: R) => string;
};

/**
 * One kind of library record — past projects or team members — listed as
 * cards, each editable in place, with one attached file. Records save
 * through /api/library/{kind}; the file goes up after, since it belongs to a
 * record id.
 */
export function RecordSection<R extends WithFile, D>(props: Props<R, D>) {
  const t = useTranslations("Library");
  const { kind, records, onChange, empty, addLabel, renderCard, nameOf } = props;
  /** "new", a record id, or null when no form is open. */
  const [editing, setEditing] = useState<string | null>(null);

  function saved(record: R, done = true) {
    onChange(records.some((item) => item.id === record.id) ? records.map((item) => (item.id === record.id ? record : item)) : [...records, record]);
    if (done) setEditing(null);
  }

  async function remove(record: R) {
    if (!window.confirm(t("deleteConfirm", { name: nameOf(record) }))) return;
    const res = await fetch(`/api/library/${kind}/${encodeURIComponent(record.id)}`, { method: "DELETE" });
    if (res.ok) onChange(records.filter((item) => item.id !== record.id));
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
      {records.length === 0 && editing !== "new" && <p className="text-sm text-ink-muted">{empty}</p>}

      {records.length > 0 && (
        <ul className="space-y-3">
          {records.map((record) =>
            editing === record.id ? (
              <li key={record.id}>
                <RecordForm {...props} record={record} onSaved={saved} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={record.id} className="rounded-lg border border-border p-4">
                {renderCard(record)}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  {record.file ? (
                    <a
                      href={`/api/library/${kind}/${encodeURIComponent(record.id)}/file`}
                      download={record.file.name}
                      className="flex min-w-0 items-center gap-1 font-medium text-accent-text underline-offset-4 hover:underline"
                    >
                      <Download size={13} className="shrink-0" />
                      <span className="truncate">{record.file.name}</span>
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-warn">
                      <AlertCircle size={12} />
                      {t("noFile", { file: props.fileLabel })}
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
        <RecordForm {...props} onSaved={saved} onCancel={() => setEditing(null)} />
      ) : (
        <div className={records.length ? "border-t border-border pt-4" : ""}>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <Plus size={14} />
            {addLabel}
          </button>
        </div>
      )}
    </div>
  );
}

type FormProps<R extends WithFile, D> = Props<R, D> & {
  record?: R;
  onSaved: (record: R, done?: boolean) => void;
  onCancel: () => void;
};

function RecordForm<R extends WithFile, D>({
  kind,
  record: initial,
  draftOf,
  bodyOf,
  missingOf,
  problemOf,
  renderFields,
  fileLabel,
  onSaved,
  onCancel,
}: FormProps<R, D>) {
  const t = useTranslations("Library");
  // Once saved, a new record is edited from then on — a retry after a failed
  // upload must update it, not create a second one.
  const [record, setRecord] = useState(initial);
  const [draft, setDraft] = useState<D>(() => draftOf(initial));
  const [file, setFile] = useState<File | null>(null);
  const [removeFile, setRemoveFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof D>(key: K, value: D[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
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

  const problem = problemOf(draft);

  async function save() {
    const missing = missingOf(draft);
    if (missing) {
      setError(missing);
      return;
    }
    setSaving(true);
    setError(null);

    const res = await fetch(record ? `/api/library/${kind}/${encodeURIComponent(record.id)}` : `/api/library/${kind}`, {
      method: record ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyOf(draft)),
    });
    if (!res.ok) {
      setError(await messageOf(res, t("saveFailed")));
      setSaving(false);
      return;
    }
    let saved = (await res.json()) as R;
    setRecord(saved);
    const fileUrl = `/api/library/${kind}/${encodeURIComponent(saved.id)}/file`;

    if (file) {
      const form = new FormData();
      form.append("file", file);
      const upload = await fetch(fileUrl, { method: "PUT", body: form });
      if (!upload.ok) {
        setError(await messageOf(upload, t("uploadFailed")));
        setSaving(false);
        onSaved(saved, false);
        return;
      }
      saved = (await upload.json()) as R;
    } else if (removeFile && saved.file) {
      const removed = await fetch(fileUrl, { method: "DELETE" });
      if (removed.ok) saved = (await removed.json()) as R;
    }

    setSaving(false);
    onSaved(saved);
  }

  const currentFile = record?.file && !removeFile && !file ? record.file : null;

  return (
    <div className="space-y-4 rounded-lg border border-accent/30 bg-surface-alt/40 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {renderFields(draft, set)}

        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-medium text-ink">{fileLabel}</span>
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

      {(error || problem) && (
        <p role="alert" className="flex items-start gap-1 text-sm text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {error ?? problem}
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
          disabled={saving || Boolean(problem)}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? t("saving") : t("save")}
        </button>
      </div>
    </div>
  );
}
