/**
 * A comment is published only after a person has looked at it: the site carries
 * public procurement announcements, and unmoderated text under a government
 * notice is a liability, not a feature.
 */
export const FEEDBACK_STATUSES = ["รอตรวจสอบ", "อนุมัติ", "ปฏิเสธ"] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
