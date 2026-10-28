import { Lock, PenLine } from "lucide-react";

import { thaiDateTime } from "@/lib/datetime";
import {
  CLASSIFICATION_LABEL,
  TOR_FIELD_LABEL,
  type TorRecord,
} from "@/types/tor";

/**
 * Who last corrected this record and when, and which fields are now locked
 * against re-imports. Nothing at all for a record no admin has touched.
 */
export function TorCorrectionInfo({
  tor,
}: {
  tor: Pick<TorRecord, "lastEdited" | "lockedFields" | "classification">;
}) {
  if (
    !tor.lastEdited &&
    !tor.lockedFields?.length &&
    tor.classification !== "not-software"
  )
    return null;

  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-alt px-5 py-4 text-sm">
      {tor.classification === "not-software" && (
        <p className="font-semibold text-danger">
          จัดเป็น{CLASSIFICATION_LABEL["not-software"]} —
          ไม่แสดงในรายการค้นหาและไม่ถูกนำไปจับคู่กับบริษัท
        </p>
      )}
      {tor.lastEdited && (
        <p className="flex items-center gap-2 text-ink-muted">
          <PenLine size={14} className="shrink-0" />
          แก้ไขล่าสุดโดย{" "}
          <span className="font-medium text-ink">{tor.lastEdited.by}</span>{" "}
          เมื่อ {thaiDateTime(tor.lastEdited.at)}
        </p>
      )}
      {!!tor.lockedFields?.length && (
        <p className="flex items-start gap-2 text-ink-muted">
          <Lock size={14} className="mt-0.5 shrink-0" />
          <span>
            ล็อกไว้ไม่ให้การนำเข้าข้อมูลรอบถัดไปเขียนทับ:{" "}
            {tor.lockedFields
              .map((field) => TOR_FIELD_LABEL[field] ?? field)
              .join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
