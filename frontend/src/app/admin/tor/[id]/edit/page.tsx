import { notFound } from "next/navigation";

import { TorCorrectionInfo } from "@/components/admin/tor-correction-info";
import { AdminPageShell } from "@/components/layout/admin-page";
import { BMA_AGENCIES } from "@/data/opportunities";
import { fetchTor } from "@/lib/tor-api";
import {
  CLASSIFICATION_LABEL,
  TOR_CLASSIFICATIONS,
  TOR_STAGES,
} from "@/types/tor";

import { updateTorEntry } from "./actions";

const inputCls =
  "h-11 w-full rounded-lg border border-border px-4 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

export default async function AdminEditTorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tor = await fetchTor(id);
  if (!tor) notFound();

  const updateWithId = updateTorEntry.bind(null, id);
  // An imported record's agency is often outside the BMA list; without its own
  // option the select would fall back to the first agency and a save would
  // silently change it.
  const bma: readonly string[] = BMA_AGENCIES;
  const agencies = bma.includes(tor.agency) ? bma : [tor.agency, ...bma];
  // Same for a stage the list doesn't know.
  const stages: readonly string[] = TOR_STAGES.includes(tor.stage) ? TOR_STAGES : [tor.stage, ...TOR_STAGES];

  return (
    <AdminPageShell title="แก้ไขรายการ TOR" description={tor.title}>
      <div className="max-w-2xl space-y-4">
        <TorCorrectionInfo tor={tor} />
        <form
          action={updateWithId}
          className="space-y-5 rounded-xl border border-border bg-surface p-6"
        >
          <Field label="ประเภทงาน">
            <select
              name="classification"
              defaultValue={tor.classification ?? "software"}
              className={inputCls}
            >
              {TOR_CLASSIFICATIONS.map((value) => (
                <option key={value} value={value}>
                  {CLASSIFICATION_LABEL[value]}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-ink-muted">
              ถ้าระบบจัดผิดว่าเป็นงานซอฟต์แวร์ เลือก
              &quot;ไม่ใช่งานซอฟต์แวร์&quot; รายการจะหายจากหน้าค้นหาและการจับคู่
            </span>
          </Field>

          <Field label="ชื่อโครงการ">
            <input
              name="title"
              required
              defaultValue={tor.title}
              className={inputCls}
            />
          </Field>

          <Field label="หน่วยงาน">
            <select
              name="agency"
              required
              defaultValue={tor.agency}
              className={inputCls}
            >
              {agencies.map((agency) => (
                <option key={agency} value={agency}>
                  {agency}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="งบประมาณ">
              <input
                name="budget"
                required
                defaultValue={tor.budget}
                className={inputCls}
              />
            </Field>
            <Field label="วันที่ปิดรับ">
              <input
                name="deadline"
                required
                defaultValue={tor.deadline}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="จำนวนวันที่เหลือ">
              <input
                name="daysLeft"
                type="number"
                min={0}
                defaultValue={tor.daysLeft}
                className={inputCls}
              />
            </Field>
            <Field label="สถานะงบประมาณ">
              <select
                name="budgetStatus"
                defaultValue={tor.budgetStatus ?? "ปกติ"}
                className={inputCls}
              >
                <option value="ปกติ">ปกติ</option>
                <option value="สูงกว่าปกติ">สูงกว่าปกติ</option>
                <option value="ต่ำกว่าปกติ">ต่ำกว่าปกติ</option>
              </select>
            </Field>
          </div>

          <Field label="สถานะ TOR">
            <select name="stage" defaultValue={tor.stage} className={inputCls}>
              {stages.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </Field>

          <Field label="แท็ก (คั่นด้วยจุลภาค)">
            <input
              name="tags"
              defaultValue={tor.tags.join(", ")}
              className={inputCls}
            />
          </Field>

          <Field label="รายละเอียดโดยย่อ">
            <textarea
              name="summary"
              required
              rows={5}
              defaultValue={tor.summary}
              className={`${inputCls} h-auto resize-none py-3`}
            />
          </Field>

          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            บันทึกการแก้ไข
          </button>
          <p className="text-xs text-ink-muted">
            ช่องที่แก้จะถูกล็อกไว้
            ไม่ให้การนำเข้าข้อมูลจากระบบต้นทางรอบถัดไปเขียนทับ
          </p>
        </form>
      </div>
    </AdminPageShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
