"use client";

import { Ban, CheckCircle2, Mail, Search } from "lucide-react";
import { useState } from "react";

import { AdminPageShell } from "@/components/layout/admin-page";
import { ADMIN_COMPANIES } from "@/data/admin";

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState(ADMIN_COMPANIES);
  const [query, setQuery] = useState("");

  function toggleStatus(id: number) {
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: c.status === "ใช้งาน" ? "ระงับ" : "ใช้งาน" } : c,
      ),
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = companies.filter(
    (c) => !q || `${c.name} ${c.email}`.toLowerCase().includes(q),
  );

  return (
    <AdminPageShell
      title="จัดการบริษัท"
      description="บริษัทที่ผ่านการอนุมัติและใช้งานระบบอยู่ในปัจจุบัน"
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
            placeholder="ค้นหาชื่อบริษัทหรืออีเมล..."
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white divide-y divide-border">
        {filtered.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-muted">ไม่พบบริษัทที่ค้นหา</p>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-4 px-5 py-4 max-sm:flex-col max-sm:items-start"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                      c.status === "ใช้งาน"
                        ? "bg-success-soft text-success"
                        : "bg-danger-soft text-danger"
                    }`}
                  >
                    {c.status}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    <Mail size={12} />
                    {c.email}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-ink">{c.name}</h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {c.specialty} · {c.size} · เข้าร่วมเมื่อ {c.joinedAt} · ติดตาม {c.torCount} TOR
                </p>
              </div>

              <button
                onClick={() => toggleStatus(c.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                  c.status === "ใช้งาน"
                    ? "border-border text-ink-muted hover:text-danger"
                    : "border-border text-ink-muted hover:text-success"
                }`}
              >
                {c.status === "ใช้งาน" ? (
                  <>
                    <Ban size={14} />
                    ระงับการใช้งาน
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
