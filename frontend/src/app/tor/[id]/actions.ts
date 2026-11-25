"use server";

import { getTranslations } from "next-intl/server";

import { idPath } from "@/lib/backend-path";
import { clientIpHeaders } from "@/lib/client-ip";
import { isReportReason } from "@/lib/report-reasons";
import { authHeaders } from "@/lib/session-headers";

export type ReportState = { error?: string; submitted?: boolean };

/**
 * Tells the admins something on this announcement is wrong. The session goes
 * with it, so a signed-in reporter is credited; a guest may leave a contact.
 * Nothing is published — the reporter is told it was received, not that the
 * record changed.
 */
export async function submitReport(
  torId: string,
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const te = await getTranslations("Errors");
  const reason = String(formData.get("reason") ?? "");
  const message = String(formData.get("message") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (!isReportReason(reason)) return { error: te("reportReasonRequired") };
  if (message.length < 10) return { error: te("reportTooShort") };

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${idPath(torId)}/reports`, {
    method: "POST",
    headers: { ...(await authHeaders()), ...(await clientIpHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ reason, message, contact: contact || undefined }),
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 429) return { error: te("reportTooFrequent") };
    const body = res.status === 400 ? await res.json().catch(() => null) : null;
    const reasonText = Array.isArray(body?.message) ? body.message[0] : body?.message;
    return { error: typeof reasonText === "string" ? reasonText : te("reportFailed") };
  }

  return { submitted: true };
}
