"use client";

import { AlertTriangle, Copy, FilePen, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Draft = { sections: { heading: string; body: string }[]; gaps: string[] };

/** Mirrors the backend's MAX_PREVIOUS_PROPOSAL and the DTO's minimum. */
const MAX_LENGTH = 20_000;
const MIN_LENGTH = 200;

/**
 * Reworks a proposal the company already wrote into a first draft for this
 * TOR. The earlier proposal is pasted, or loaded from a text file, and the
 * draft comes back section by section with the gaps the model would not fill.
 */
export function ProposalDraftForm({ torId }: { torId: string }) {
  const t = useTranslations("ProposalDraft");
  const [previous, setPrevious] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setPrevious((await file.text()).slice(0, MAX_LENGTH));
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setDraft(null);
    const res = await fetch(`/api/ai/proposal-draft/${torId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousProposal: previous }),
    }).catch(() => null);
    setBusy(false);

    const body = (await res?.json().catch(() => null)) as (Draft & { message?: string | string[] }) | null;
    if (res?.ok && body?.sections) {
      setDraft(body);
      return;
    }
    if (res?.status === 401) setError(t("signInRequired"));
    else if (res?.status === 503) setError(t("aiUnavailable"));
    else setError((Array.isArray(body?.message) ? body.message.join(" · ") : body?.message) ?? t("failed"));
  }

  async function copyAll() {
    if (!draft) return;
    const text = draft.sections.map((s) => `${s.heading}\n\n${s.body}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
        <FilePen size={18} className="text-ink-subtle" />
        {t("heading")}
      </h2>
      <p className="mb-4 text-sm text-ink-muted">{t("description")}</p>

      <textarea
        value={previous}
        onChange={(e) => setPrevious(e.target.value.slice(0, MAX_LENGTH))}
        rows={8}
        placeholder={t("placeholder")}
        className="w-full rounded-lg border border-border bg-surface p-3 text-sm leading-relaxed text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-dark">
          <Upload size={14} />
          {t("loadFile")}
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="sr-only"
            onChange={(e) => loadFile(e.target.files?.[0])}
          />
        </label>
        <span className="text-xs text-ink-subtle">
          {previous.length.toLocaleString("th-TH")} / {MAX_LENGTH.toLocaleString("th-TH")}
        </span>
      </div>

      <button
        onClick={generate}
        disabled={busy || previous.trim().length < MIN_LENGTH}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-dark disabled:opacity-50"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {busy ? t("generating") : t("generate")}
      </button>
      {previous.trim().length > 0 && previous.trim().length < MIN_LENGTH && (
        <p className="mt-2 text-xs text-ink-subtle">{t("tooShort", { min: MIN_LENGTH })}</p>
      )}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {draft && (
        <div className="mt-6 border-t border-border pt-5">
          {draft.gaps.length > 0 && (
            <div className="mb-5 rounded-lg bg-warn-soft p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-warn">
                <AlertTriangle size={14} />
                {t("gaps")}
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-warn">
                {draft.gaps.map((gap) => (
                  <li key={gap}>{gap}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mb-3 flex justify-end">
            <button
              onClick={copyAll}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-alt"
            >
              <Copy size={13} />
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <div className="space-y-5">
            {draft.sections.map((section) => (
              <div key={section.heading}>
                <h3 className="mb-1.5 text-sm font-semibold text-ink">{section.heading}</h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{section.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 border-t border-border pt-3 text-xs text-ink-subtle">{t("disclaimer")}</p>
        </div>
      )}
    </section>
  );
}
