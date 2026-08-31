"use client";

import { Ban, CheckCircle2, Search } from "lucide-react";
import { useState } from "react";

import { AdminPageShell } from "@/components/layout/admin-page";
import { ADMIN_USERS } from "@/data/admin";

export default function AdminUsersPage() {
  const [users, setUsers] = useState(ADMIN_USERS);
  const [query, setQuery] = useState("");

  function toggleStatus(id: number) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === "ใช้งาน" ? "ระงับ" : "ใช้งาน" } : u,
      ),
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = users.filter(
    (u) => !q || `${u.name} ${u.email} ${u.company}`.toLowerCase().includes(q),
  );

  return (
    <AdminPageShell
      title="จัดการผู้ใช้งาน"
      description="ผู้ใช้งานทั้งหมดในระบบ ทั้งฝั่งบริษัทและผู้ดูแลระบบ"
    >
      <div className="mb-5">
        <label className="relative block max-w-sm">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่อ, อีเมล, หรือบริษัท..."
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">ไม่พบผู้ใช้งานที่ค้นหา</p>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-4 px-5 py-4 max-sm:flex-col max-sm:items-start"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-alt text-xs font-semibold text-ink-muted">
                {u.name.charAt(0)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      u.status === "ใช้งาน"
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger"
                    }`}
                  >
                    {u.status}
                  </span>
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      u.role === "ผู้ดูแลระบบ"
                        ? "bg-danger-soft text-danger"
                        : "bg-accent-soft text-accent-text"
                    }`}
                  >
                    {u.role}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-ink">{u.name}</h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {u.email} · {u.company} · ใช้งานล่าสุด {u.lastActive}
                </p>
              </div>

              <button
                onClick={() => toggleStatus(u.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {u.status === "ใช้งาน" ? (
                  <>
                    <Ban size={14} />
                    ระงับบัญชี
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    เปิดใช้งานอีกครั้ง
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </AdminPageShell>
  );
}
