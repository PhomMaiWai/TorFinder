"use client";

import {
  AlertCircle,
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { TorRecord } from "@/types/tor";

/** Dated on the server, so the label can't differ between server and browser time zones. */
type TorDocument = NonNullable<TorRecord["documents"]>[number] & { dateLabel: string };

/** One row, whichever source it came from. `src` is set when the file can be shown in place. */
type Entry = {
  key: string;
  label: string;
  meta: string;
  src?: string;
  /** A zipped bundle: where to list the files inside it. */
  archiveUrl?: string;
  /** Where the original lives, for a file that can't be shown here. */
  sourceUrl: string;
};

type ArchiveFile = { entry: number; name: string; label: string; size: number };

const SIZE = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 });

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${SIZE.format(bytes / 1024 / 1024)} MB` : `${SIZE.format(bytes / 1024)} KB`;
}

type EgpDocument = {
  kind: string;
  label: string;
  /** A bundle, opened file by file, rather than a single PDF. */
  archive: boolean;
  /** Pattern for the record's own announcement labels this stands in for. */
  covers: string;
};

function withDownload(src: string): string {
  return `${src}?download=1`;
}

/**
 * Every file the announcement published, each opened in place: a modal
 * viewer over the page rather than a new tab on the portal. When the record
 * only links to process5's search page, the national e-GP's own copies are
 * looked up by project number after the page has rendered, so they never
 * hold up the rest of it.
 */
export function TorDocumentList({
  torId,
  documents,
  projectNumber,
  egpSourceUrl,
}: {
  torId: string;
  documents: TorDocument[];
  /** Set when the national e-GP is worth asking for this project's documents. */
  projectNumber?: string;
  egpSourceUrl: string;
}) {
  const t = useTranslations("TorDocuments");
  const [open, setOpen] = useState<Entry | null>(null);
  const [egp, setEgp] = useState<EgpDocument[] | "loading" | null>(projectNumber ? "loading" : null);

  useEffect(() => {
    if (!projectNumber) return;
    const request = new AbortController();
    fetch(`/api/tor/${encodeURIComponent(torId)}/egp-documents`, { signal: request.signal })
      .then((res) => (res.ok ? (res.json() as Promise<EgpDocument[]>) : []))
      .then(setEgp)
      .catch(() => {
        if (!request.signal.aborted) setEgp(null);
      });
    return () => request.abort();
  }, [torId, projectNumber]);

  const base = `/api/tor/${encodeURIComponent(torId)}`;
  const egpDocs = Array.isArray(egp) ? egp : [];
  const coverOf = (label: string) => egpDocs.find((doc) => new RegExp(doc.covers).test(label));

  // A row with no file of its own is replaced by the e-GP copy of the same
  // announcement, which inherits its publication date — one row per
  // announcement, and every one of them openable where a copy exists.
  const covered = new Map<string, string>();
  const ownRows: Entry[] = documents.flatMap((doc, index) => {
    const openable = doc.viewable || doc.archive;
    const cover = openable ? undefined : coverOf(doc.label);
    if (cover) {
      if (!covered.has(cover.kind)) covered.set(cover.kind, doc.dateLabel);
      return [];
    }
    return [
      {
        key: `${index}-${doc.url}`,
        label: doc.label,
        meta: doc.dateLabel,
        src: doc.viewable ? `${base}/documents/${index}` : undefined,
        archiveUrl: doc.archive ? `${base}/documents/${index}/entries` : undefined,
        sourceUrl: doc.url,
      },
    ];
  });
  const egpRows: Entry[] = egpDocs.map((doc) => {
    const path = `${base}/egp-documents/${doc.kind}`;
    const date = covered.get(doc.kind);
    return {
      key: `egp-${doc.kind}`,
      label: doc.label,
      meta: date ? `${date} · ${t("fromEgp")}` : t("fromEgp"),
      src: doc.archive ? undefined : path,
      archiveUrl: doc.archive ? `${path}/entries` : undefined,
      sourceUrl: egpSourceUrl,
    };
  });
  const entries = [...egpRows, ...ownRows];

  if (entries.length === 0 && egp !== "loading") {
    return <p className="text-sm text-ink-muted">{t("none")}</p>;
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {egp === "loading" && (
          <li className="flex items-center gap-2 py-3 text-sm text-ink-muted first:pt-0 last:pb-0">
            <Loader2 size={15} className="animate-spin" />
            {t("lookingUpEgp")}
          </li>
        )}
        {entries.map((entry) =>
          entry.archiveUrl ? (
            <ArchiveRow key={entry.key} entry={entry} listUrl={entry.archiveUrl} onOpen={setOpen} />
          ) : (
            <li
              key={entry.key}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-ink">{entry.label}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{entry.meta}</p>
              </div>
              {entry.src ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setOpen(entry)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                  >
                    <Eye size={14} />
                    {t("view")}
                  </button>
                  <a
                    href={withDownload(entry.src)}
                    aria-label={t("download")}
                    title={t("download")}
                    className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
                  >
                    <Download size={15} />
                  </a>
                </div>
              ) : (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                >
                  <ExternalLink size={14} />
                  {t("openSource")}
                </a>
              )}
            </li>
          ),
        )}
      </ul>

      {open?.src && (
        <DocumentViewer key={open.key} entry={open} src={open.src} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

/**
 * A zipped bundle, opened on request: the file list is only fetched when the
 * reader expands it, and each PDF or image inside opens in the same viewer.
 */
function ArchiveRow({
  entry,
  listUrl,
  onOpen,
}: {
  entry: Entry;
  listUrl: string;
  onOpen: (entry: Entry) => void;
}) {
  const t = useTranslations("TorDocuments");
  const [expanded, setExpanded] = useState(false);
  const [files, setFiles] = useState<ArchiveFile[] | "loading" | "failed" | null>(null);

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (!next || files !== null) return;
    setFiles("loading");
    fetch(listUrl)
      .then((res) =>
        res.ok ? (res.json() as Promise<ArchiveFile[]>) : Promise.reject(new Error(String(res.status))),
      )
      .then(setFiles)
      .catch(() => setFiles("failed"));
  }

  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium text-ink">{entry.label}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{entry.meta}</p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
        >
          <FolderOpen size={14} />
          {t("openArchive")}
          <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 rounded-lg border border-border bg-surface-alt/60">
          {files === "loading" && (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-ink-muted">
              <Loader2 size={15} className="animate-spin" />
              {t("archiveLoading")}
            </p>
          )}
          {files === "failed" && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm text-ink-muted">
              {t("archiveFailed")}
              <a
                href={entry.sourceUrl}
                className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-dark"
              >
                <Download size={14} />
                {t("downloadZip")}
              </a>
            </p>
          )}
          {Array.isArray(files) && files.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">{t("archiveEmpty")}</p>
          )}
          {Array.isArray(files) && files.length > 0 && (
            <ul className="divide-y divide-border">
              {files.map((file) => {
                const src = `${listUrl}/${file.entry}`;
                const child: Entry = {
                  key: `${entry.key}/${file.entry}`,
                  label: file.label,
                  meta: `${file.name} · ${fileSize(file.size)}`,
                  src,
                  sourceUrl: entry.sourceUrl,
                };
                return (
                  <li
                    key={child.key}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-ink">{child.label}</p>
                      <p className="mt-0.5 break-all text-xs text-ink-muted">{child.meta}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onOpen(child)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                      >
                        <Eye size={14} />
                        {t("view")}
                      </button>
                      <a
                        href={withDownload(src)}
                        aria-label={t("download")}
                        title={t("download")}
                        className="grid size-8 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function DocumentViewer({ entry, src, onClose }: { entry: Entry; src: string; onClose: () => void }) {
  const t = useTranslations("TorDocuments");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  // A native modal: focus trap, Escape and an inert page behind it come for free.
  // No close() on cleanup: its "close" event lands after a Strict Mode remount
  // and would shut the viewer it just reopened. Unmounting removes it anyway.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = overflow;
    };
  }, []);

  function handleLoad(event: React.SyntheticEvent<HTMLIFrameElement>) {
    // Same origin, so the frame can be inspected: a failure comes back as a JSON
    // error (or an HTML page), never as the PDF or image that was asked for.
    let contentType: string | undefined;
    try {
      contentType = event.currentTarget.contentDocument?.contentType;
    } catch {
      contentType = undefined;
    }
    const failed = contentType === "application/json" || contentType === "text/html";
    setState(failed ? "failed" : "ready");
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-labelledby="document-viewer-title"
      className="m-auto h-[92dvh] w-[min(1200px,96vw)] max-w-none overflow-hidden rounded-2xl border border-border bg-surface p-0 text-ink shadow-xl backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <FileText size={18} className="shrink-0 text-ink-subtle" />
          <div className="min-w-0 flex-1">
            <h2 id="document-viewer-title" className="truncate text-sm font-semibold text-ink">
              {entry.label}
            </h2>
            <p className="text-xs text-ink-muted">{entry.meta}</p>
          </div>
          <a
            href={src}
            target="_blank"
            rel="noopener"
            className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink sm:flex"
          >
            <ExternalLink size={14} />
            {t("newTab")}
          </a>
          <a
            href={withDownload(src)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <Download size={14} />
            <span className="hidden sm:inline">{t("download")}</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>

        <div className="relative flex-1 bg-surface-alt">
          {state !== "failed" && (
            <iframe src={src} title={entry.label} onLoad={handleLoad} className="size-full border-0" />
          )}

          {state === "loading" && (
            <div className="absolute inset-0 grid place-items-center bg-surface-alt">
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Loader2 size={18} className="animate-spin" />
                {t("loading")}
              </div>
            </div>
          )}

          {state === "failed" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <AlertCircle size={28} className="mx-auto mb-3 text-ink-subtle" />
                <p className="text-sm font-medium text-ink">{t("failed")}</p>
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-alt"
                >
                  <ExternalLink size={14} />
                  {t("openSource")}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
