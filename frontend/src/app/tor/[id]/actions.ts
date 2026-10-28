"use server";

import { revalidatePath } from "next/cache";

export type FeedbackState = { error?: string; submitted?: boolean };

/**
 * Files a comment on an announcement. It is held for review, so the page says
 * "received" rather than showing the comment — pretending it is published would
 * be a lie the reader finds out about later.
 */
export async function submitFeedback(
  torId: string,
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  const text = String(formData.get("text") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();

  if (text.length < 10) {
    return { error: "กรุณาเขียนความคิดเห็นอย่างน้อย 10 ตัวอักษร" };
  }

  const res = await fetch(`${process.env.BACKEND_URL}/api/tor/${torId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, author: author || undefined }),
    cache: "no-store",
  });

  if (!res.ok) {
    // 429 is the rate limit, and saying so beats a generic failure.
    if (res.status === 429) return { error: "ส่งความคิดเห็นถี่เกินไป กรุณารอสักครู่" };
    // A 400 says why in its own words — e.g. the comment period closed while the page was open.
    const body = res.status === 400 ? await res.json().catch(() => null) : null;
    return { error: typeof body?.message === "string" ? body.message : "ส่งความคิดเห็นไม่สำเร็จ" };
  }

  revalidatePath(`/tor/${torId}`);
  return { submitted: true };
}
