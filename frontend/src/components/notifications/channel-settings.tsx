"use client";

import { Hash, Mail, MessageCircle, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

type Channel = "email" | "slack" | "line";

type ChannelsResponse = {
  channels: { email: boolean; slackWebhookUrl?: string; lineUserId?: string };
  available: Record<Channel, boolean>;
};

type TestResult = { channel: Channel; ok: boolean; error?: string };

const INPUT =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none disabled:opacity-50";

/**
 * Where notifications go besides the in-app list. Email goes to the sign-in
 * address; Slack and LINE need something only the company has, so it pastes
 * that here. A channel the server isn't configured for is shown but disabled.
 */
export function ChannelSettings() {
  const t = useTranslations("NotificationsPage");
  const [loaded, setLoaded] = useState<ChannelsResponse | null>(null);
  const [email, setEmail] = useState(false);
  const [slack, setSlack] = useState("");
  const [line, setLine] = useState("");
  const [status, setStatus] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/channels")
      .then((res) => (res.ok ? (res.json() as Promise<ChannelsResponse>) : null))
      .then((data) => {
        if (!data) return;
        setLoaded(data);
        setEmail(data.channels.email);
        setSlack(data.channels.slackWebhookUrl ?? "");
        setLine(data.channels.lineUserId ?? "");
      })
      .catch(() => setLoaded(null));
  }, []);

  if (!loaded) return null;
  const { available } = loaded;

  async function save() {
    setBusy(true);
    setStatus(null);
    setResults([]);
    const res = await fetch("/api/notifications/channels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, slackWebhookUrl: slack.trim(), lineUserId: line.trim() }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setStatus({ tone: "success", text: t("channelsSaved") });
      return;
    }
    const body = (await res?.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(" · ") : body?.message;
    setStatus({ tone: "danger", text: message ?? t("channelsSaveFailed") });
  }

  async function test() {
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/notifications/channels/test", { method: "POST" }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as TestResult[]) : [];
    setBusy(false);
    setResults(data);
    if (data.length === 0) setStatus({ tone: "danger", text: t("channelsTestNone") });
  }

  return (
    <section className="mb-6 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-base font-bold text-ink">{t("channelsHeading")}</h2>
      <p className="mt-0.5 mb-4 text-sm text-ink-muted">{t("channelsDescription")}</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="flex items-start gap-3 rounded-lg border border-border p-4">
          <input
            type="checkbox"
            checked={email}
            disabled={!available.email}
            onChange={(e) => setEmail(e.target.checked)}
            className="mt-1 size-4 accent-accent"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Mail size={15} className="text-ink-subtle" />
              {t("channelEmail")}
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              {available.email ? t("channelEmailHint") : t("channelUnavailable")}
            </span>
          </span>
        </label>

        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Hash size={15} className="text-ink-subtle" />
            Slack
          </p>
          <input
            value={slack}
            onChange={(e) => setSlack(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-ink-muted">{t("channelSlackHint")}</p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <MessageCircle size={15} className="text-ink-subtle" />
            LINE
          </p>
          <input
            value={line}
            disabled={!available.line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="U1234…"
            className={INPUT}
          />
          <p className="mt-1.5 text-xs text-ink-muted">
            {available.line ? t("channelLineHint") : t("channelUnavailable")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:opacity-50"
        >
          {t("channelsSave")}
        </button>
        <button
          onClick={test}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-alt disabled:opacity-50"
        >
          <Send size={14} />
          {t("channelsTest")}
        </button>
        {status && (
          <span className={`text-sm ${status.tone === "success" ? "text-success" : "text-danger"}`}>
            {status.text}
          </span>
        )}
        {results.map((result) => (
          <span
            key={result.channel}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              result.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
            }`}
            title={result.error}
          >
            {result.channel} {result.ok ? "✓" : "✕"}
          </span>
        ))}
      </div>
    </section>
  );
}
