"use client";

import { BellOff } from "lucide-react";
import { useState } from "react";

import { PageBody, PageHeader } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import {
  NOTIFICATION_FILTERS,
  NOTIFICATION_ICONS,
  NOTIFICATION_TONE,
  NOTIFICATIONS,
  type NotificationType,
} from "@/data/notifications";

type FilterId = "all" | "unread" | NotificationType;

const TONE_ICON_CLS = {
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success",
  neutral: "bg-surface-alt text-ink-muted",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [filter, setFilter] = useState<FilterId>("all");
  const unreadCount = notifications.filter((n) => !n.read).length;

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: number) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="การแจ้งเตือน"
        description={
          unreadCount > 0
            ? `${unreadCount} รายการที่ยังไม่ได้อ่าน`
            : "อ่านครบทุกรายการแล้ว"
        }
        action={
          unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex h-9 items-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-alt"
            >
              ทำเครื่องหมายว่าอ่านแล้วทั้งหมด
            </button>
          )
        }
      />

      <PageBody>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {NOTIFICATION_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === id
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-500 ring-1 ring-zinc-200 hover:text-zinc-800"
              }`}
            >
              {label}
              {id === "unread" && unreadCount > 0 && (
                <span
                  className={`flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold ${
                    filter === id ? "bg-white/20 text-white" : "bg-danger text-white"
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-20 text-center">
            <BellOff size={28} className="mx-auto mb-3 text-ink-subtle" />
            <p className="text-sm font-medium text-ink">ไม่มีการแจ้งเตือนในหมวดนี้</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-white divide-y divide-border">
            {filtered.map((n) => {
              const Icon = NOTIFICATION_ICONS[n.type];
              return (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`flex w-full items-start gap-4 border-l-2 px-5 py-4 text-left transition-colors hover:bg-surface-alt/70 ${
                    n.read ? "border-transparent" : "border-accent bg-accent-soft/30"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${TONE_ICON_CLS[NOTIFICATION_TONE[n.type]]}`}
                  >
                    <Icon size={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-accent" />}
                    </div>
                    <p className="mt-0.5 text-sm text-ink-muted">{n.message}</p>
                  </div>

                  <span className="shrink-0 text-xs text-ink-subtle">{n.time}</span>
                </button>
              );
            })}
          </div>
        )}
      </PageBody>
    </AppShell>
  );
}
