"use client";

import { FileText, Info, Landmark, Tags } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AdminPageShell } from "@/components/layout/admin-page";
import { BMA_AGENCIES } from "@/data/opportunities";

import { createTorEntry, type CreateTorState } from "./actions";

const inputCls =
  "h-11 w-full rounded-lg border border-border px-4 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

const INITIAL_STATE: CreateTorState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "กำลังบันทึก..." : "บันทึกรายการ"}
    </button>
  );
}

export default function AdminCreateTorPage() {
  const [state, formAction] = useActionState(createTorEntry, INITIAL_STATE);

  return (
    <AdminPageShell title="เพิ่มรายการ TOR" description="เพิ่มรายการ TOR เข้าระบบด้วยตนเอง">
      <form action={formAction} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section icon={FileText} title="ข้อมูลโครงการ">
            <Field label="ชื่อโครงการ">
              <input name="title" required placeholder="เช่น พัฒนาระบบบริหารจัดการ..." className={inputCls} />
            </Field>
            <Field label="หน่วยงาน">
              <select name="agency" required defaultValue="" className={inputCls}>
                <option value="" disabled>
                  เลือกหน่วยงาน
                </option>
                {BMA_AGENCIES.map((agency) => (
                  <option key={agency} value={agency}>
                    {agency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="สถานะ TOR">
              <select name="stage" defaultValue="เปิดรับฟังความคิดเห็น" className={inputCls}>
                <option value="เปิดรับฟังความคิดเห็น">เปิดรับฟังความคิดเห็น</option>
                <option value="ประกาศ TOR">ประกาศ TOR</option>
                <option value="ประกาศผู้ชนะ">ประกาศผู้ชนะ</option>
              </select>
            </Field>
          </Section>

          <Section icon={Landmark} title="งบประมาณและกำหนดการ">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="งบประมาณ">
                <input name="budget" required placeholder="฿1,200,000" className={inputCls} />
              </Field>
              <Field label="สถานะงบประมาณ">
                <select name="budgetStatus" defaultValue="ปกติ" className={inputCls}>
                  <option value="ปกติ">ปกติ</option>
                  <option value="สูงกว่าปกติ">สูงกว่าปกติ</option>
                  <option value="ต่ำกว่าปกติ">ต่ำกว่าปกติ</option>
                </select>
              </Field>
              <Field label="วันที่ปิดรับ">
                <input name="deadline" required placeholder="18 ส.ค. 2569" className={inputCls} />
              </Field>
              <Field label="จำนวนวันที่เหลือ">
                <input name="daysLeft" type="number" min={0} defaultValue={0} className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section icon={Tags} title="รายละเอียดเพิ่มเติม">
            <Field label="แท็ก (คั่นด้วยจุลภาค)">
              <input name="tags" placeholder="Next.js, Cloud, API" className={inputCls} />
            </Field>
            <Field label="รายละเอียดโดยย่อ">
              <textarea
                name="summary"
                required
                rows={5}
                placeholder="อธิบายขอบเขตงานโดยสังเขป"
                className={`${inputCls} h-auto resize-none py-3`}
              />
            </Field>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:h-fit lg:col-span-1">
          <div className="rounded-xl border border-border bg-surface-alt p-5">
            <div className="mb-2 flex items-center gap-2">
              <Info size={16} className="text-accent" />
              <h3 className="text-sm font-bold text-ink">คำแนะนำ</h3>
            </div>
            <ul className="space-y-2 text-xs leading-relaxed text-ink-muted">
              <li>ระบุชื่อโครงการให้ชัดเจน ตรงกับที่ประกาศจริง</li>
              <li>รูปแบบงบประมาณ/วันที่ควรเขียนให้เหมือนรายการอื่นในระบบ</li>
              <li>แท็กช่วยให้ผู้ประกอบการค้นหาเจอง่ายขึ้น</li>
              <li>รายการที่เพิ่มจะไปแสดงในหน้าค้นหา TOR ทันที</li>
            </ul>
          </div>

          {state.error && (
            <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-4 py-2.5 text-sm text-danger">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </aside>
      </form>
    </AdminPageShell>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <div className="mb-5 flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent">
          <Icon size={16} />
        </span>
        <h2 className="text-sm font-bold text-ink">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
