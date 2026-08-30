"use client";

import { Check } from "lucide-react";
import { type SubmitEvent, useState } from "react";

import { PageBody, PageHeader, Section } from "@/components/layout/app-page";
import { AppShell } from "@/components/layout/app-sidebar";
import {
  COMPANY_PROFILE,
  COMPANY_SIZE_OPTIONS,
  TECH_STACK_OPTIONS,
  type CompanySize,
} from "@/data/company-profile";

export default function ProfilePage() {
  const [name, setName] = useState(COMPANY_PROFILE.name);
  const [taxId, setTaxId] = useState(COMPANY_PROFILE.taxId);
  const [email, setEmail] = useState(COMPANY_PROFILE.email);
  const [contactName, setContactName] = useState(COMPANY_PROFILE.contactName);
  const [phone, setPhone] = useState(COMPANY_PROFILE.phone);
  const [address, setAddress] = useState(COMPANY_PROFILE.address);
  const [specialty, setSpecialty] = useState(COMPANY_PROFILE.specialty);
  const [size, setSize] = useState<CompanySize>(COMPANY_PROFILE.size);
  const [techStack, setTechStack] = useState<string[]>(COMPANY_PROFILE.techStack);
  const [saved, setSaved] = useState(false);

  const percent = Math.round(
    (
      [
        name.trim(),
        taxId.trim(),
        email.trim(),
        contactName.trim(),
        phone.trim(),
        address.trim(),
        specialty.trim(),
        size,
        techStack.length > 0 ? "x" : "",
      ].filter(Boolean).length /
        9
    ) * 100,
  );

  function toggleTech(tag: string) {
    setTechStack((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  }

  return (
    <AppShell>
      <PageHeader
        title="โปรไฟล์บริษัท"
        description="ข้อมูลนี้ใช้คำนวณคะแนนความเหมาะสม (match score) กับ TOR ใหม่ที่เข้ามา"
      />

      <PageBody>
        <form onSubmit={handleSave} className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-8">
          <Section title="ข้อมูลบัญชี">
            <div className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  อีเมลบริษัท
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  เบอร์โทรศัพท์
                </span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
            </div>
          </Section>

          <Section title="ข้อมูลบริษัท">
            <div className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  ชื่อบริษัท
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  เลขทะเบียนนิติบุคคล
                </span>
                <input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  ชื่อผู้ติดต่อ
                </span>
                <input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  ความเชี่ยวชาญ
                </span>
                <input
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  ขนาดบริษัท
                </span>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value as CompanySize)}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                >
                  {COMPANY_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-ink">
                  ที่อยู่บริษัท
                </span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-border px-3 py-2 text-sm text-ink outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10"
                />
              </label>
            </div>
          </Section>

          <Section title="Tech Stack">
            <div className="rounded-xl border border-border bg-white p-5">
              <p className="mb-3 text-sm text-ink-muted">
                เลือกเทคโนโลยีที่บริษัทถนัด ใช้จับคู่กับแท็กของ TOR
              </p>
              <div className="flex flex-wrap gap-2">
                {TECH_STACK_OPTIONS.map((tag) => {
                  const active = techStack.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => toggleTech(tag)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        active
                          ? "bg-accent-soft text-accent-text"
                          : "border border-border text-ink-muted hover:text-ink"
                      }`}
                    >
                      {active && <Check size={13} />}
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-white p-5 text-center">
            <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-accent-soft text-lg font-bold text-accent-text">
              {name.trim().charAt(0) || "A"}
            </span>
            <p className="truncate text-sm font-semibold text-ink">
              {name.trim() || "ชื่อบริษัท"}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">
              {specialty.trim() || "ความเชี่ยวชาญ"}
            </p>

            <div className="mt-4 text-left">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-ink-muted">ความสมบูรณ์ของโปรไฟล์</span>
                <span className="font-bold text-ink">{percent}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            บันทึกโปรไฟล์
          </button>
          {saved && (
            <p className="text-center text-sm font-medium text-success">บันทึกแล้ว</p>
          )}
        </aside>
        </form>
      </PageBody>
    </AppShell>
  );
}
