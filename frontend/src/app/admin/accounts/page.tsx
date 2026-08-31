"use client";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Mail,
  MapPin,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { AdminPageShell } from "@/components/layout/admin-page";
import { PENDING_ACCOUNTS } from "@/data/admin";

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState(PENDING_ACCOUNTS);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function updateAccountStatus(id: number, status: "อนุมัติ" | "ปฏิเสธ") {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  function toggleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <AdminPageShell
      title="บัญชีรออนุมัติ"
      description="ตรวจสอบและอนุมัติบัญชีบริษัทที่สมัครเข้ามาใหม่"
    >
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <div className="py-20 text-center">
            <CheckCircle2 size={36} className="mx-auto mb-3 text-success opacity-70" />
            <p className="text-base font-semibold text-ink">ไม่มีบัญชีรออนุมัติ</p>
          </div>
        ) : (
          accounts.map((a) => {
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-border bg-white">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(a.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleExpand(a.id);
                    }
                  }}
                  className="flex w-full cursor-pointer items-start justify-between gap-4 p-5 text-left max-sm:flex-col"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                          a.status === "อนุมัติ"
                            ? "bg-success-soft text-success"
                            : a.status === "ปฏิเสธ"
                              ? "bg-danger-soft text-danger"
                              : "bg-warn-soft text-warn"
                        }`}
                      >
                        {a.status}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-ink-muted">
                        <Mail size={12} />
                        {a.email}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-ink">{a.companyName}</h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {a.specialty} · {a.size} · สมัครเมื่อ {a.submittedAt}
                    </p>
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {a.status === "รอตรวจสอบ" && (
                      <>
                        <button
                          onClick={() => updateAccountStatus(a.id, "ปฏิเสธ")}
                          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                        >
                          <XCircle size={15} />
                          ปฏิเสธ
                        </button>
                        <button
                          onClick={() => updateAccountStatus(a.id, "อนุมัติ")}
                          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
                        >
                          <Check size={15} />
                          อนุมัติ
                        </button>
                      </>
                    )}
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-ink-subtle transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-surface-alt/50 px-5 py-4">
                    <p className="mb-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
                      รายละเอียดบริษัท
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <Building2 size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
                        <div>
                          <p className="text-xs text-ink-muted">เลขทะเบียนนิติบุคคล</p>
                          <p className="text-sm text-ink">{a.taxId}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
                        <div>
                          <p className="text-xs text-ink-muted">ชื่อผู้ติดต่อ</p>
                          <p className="text-sm text-ink">{a.contactName}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
                        <div>
                          <p className="text-xs text-ink-muted">เบอร์โทรศัพท์</p>
                          <p className="text-sm text-ink">{a.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <MapPin size={14} className="mt-0.5 shrink-0 text-ink-subtle" />
                        <div>
                          <p className="text-xs text-ink-muted">ที่อยู่บริษัท</p>
                          <p className="text-sm text-ink">{a.address}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </AdminPageShell>
  );
}
