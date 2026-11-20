"use client";

import { Download, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OffsiteLink } from "@/components/ui/offsite-link";

type Run = {
  id: string;
  status: "running" | "done" | "failed";
  total: number;
  counts: Record<"created" | "updated" | "known" | "skipped" | "failed", number>;
  notes: string[];
};

const SEARCH_URL = "https://process5.gprocurement.go.th/egp-agpc01-web/announcement";
const POLL_MS = 2_000;
/** A capture reads one project about every second; 100 of them fit well inside this. */
const POLL_LIMIT = 150;
const PROJECT_NUMBER = /\b\d{11}\b/g;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Imports projects from the national e-GP by number. Its search is behind a
 * bot check this app does not get past, so the admin searches there in their
 * own browser and pastes what they found — any text works, the 11-digit
 * project numbers are picked out of it.
 */
export function GprocCapture() {
  const router = useRouter();
  const t = useTranslations("AdminTor.gproc");
  const te = useTranslations("Errors");
  const [text, setText] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const numbers = [...new Set(text.match(PROJECT_NUMBER) ?? [])];

  async function capture() {
    setBusy(true);
    setError(null);
    setRun(null);
    try {
      const res = await fetch("/api/gproc/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectNumbers: numbers.slice(0, 100) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          res.status === 409
            ? t("busyElsewhere")
            : (body?.message?.toString?.() ?? t("failedStatus", { status: res.status })),
        );
        return;
      }

      let current: Run = await res.json();
      setRun(current);
      for (let i = 0; i < POLL_LIMIT && current.status === "running"; i++) {
        await sleep(POLL_MS);
        const poll = await fetch(`/api/gproc/capture/${current.id}`, { cache: "no-store" });
        if (!poll.ok) break;
        current = await poll.json();
        setRun(current);
      }
      if (current.status !== "running") {
        setText("");
        router.refresh();
      }
    } catch {
      setError(te("systemConnectionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{t("heading")}</h2>
        <OffsiteLink
          href={SEARCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-dark"
        >
          {t("openSearch")} <ExternalLink size={12} />
        </OffsiteLink>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-ink-muted">
        {t("help")}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={t("placeholder")}
        className="w-full rounded-lg border border-border bg-surface-alt p-3 font-mono text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={capture}
          disabled={busy || numbers.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          <Download size={15} />
          {busy ? t("importing") : t("importN", { count: numbers.length })}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {run && (
          <p className="text-sm text-ink-muted">
            {run.status === "running" ? t("running") : run.status === "failed" ? t("failed") : t("done")}
            {t("counts", run.counts)}
          </p>
        )}
      </div>
      {run && run.notes.length > 0 && run.status !== "running" && (
        <ul className="mt-3 max-h-40 space-y-0.5 overflow-y-auto text-xs text-ink-subtle">
          {run.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
