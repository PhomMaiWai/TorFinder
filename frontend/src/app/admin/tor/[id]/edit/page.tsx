import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/layout/admin-page";
import { BMA_AGENCIES } from "@/data/opportunities";
import { fetchTor } from "@/lib/tor-api";

import { updateTorEntry } from "./actions";

const inputCls =
  "h-11 w-full rounded-lg border border-border px-4 text-sm text-ink outline-none placeholder:text-ink-subtle focus:border-accent/40 focus:ring-2 focus:ring-accent/10";

export default async function AdminEditTorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tor = await fetchTor(id);
  if (!tor) notFound();

  const updateWithId = updateTorEntry.bind(null, id);

  return (
    <AdminPageShell title="แก้ไขรายการ TOR" description={tor.title}>
      <form
        action={updateWithId}
        className="max-w-2xl space-y-5 rounded-xl border border-border bg-white p-6"
      >
        <Field label="ชื่อโครงการ">
          <input name="title" required defaultValue={tor.title} className={inputCls} />
        </Field>

        <Field label="หน่วยงาน">
          <select name="agency" required defaultValue={tor.agency} className={inputCls}>
            {BMA_AGENCIES.map((agency) => (
              <option key={agency} value={agency}>
                {agency}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="งบประมาณ">
            <input name="budget" required defaultValue={tor.budget} className={inputCls} />
          </Field>
          <Field label="วันที่ปิดรับ">
            <input name="deadline" required defaultValue={tor.deadline} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            <select name="budgetStatus" defaultValue={tor.budgetStatus ?? "ปกติ"} className={inputCls}>
              <option value="ปกติ">ปกติ</option>
              <option value="สูงกว่าปกติ">สูงกว่าปกติ</option>
              <option value="ต่ำกว่าปกติ">ต่ำกว่าปกติ</option>
            </select>
          </Field>
        </div>

        <Field label="สถานะ TOR">
          <select name="stage" defaultValue={tor.stage} className={inputCls}>
            <option value="เปิดรับฟังความคิดเห็น">เปิดรับฟังความคิดเห็น</option>
            <option value="ประกาศ TOR">ประกาศ TOR</option>
            <option value="ประกาศผู้ชนะ">ประกาศผู้ชนะ</option>
          </select>
        </Field>

        <Field label="แท็ก (คั่นด้วยจุลภาค)">
          <input name="tags" defaultValue={tor.tags.join(", ")} className={inputCls} />
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
      </form>
    </AdminPageShell>
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
