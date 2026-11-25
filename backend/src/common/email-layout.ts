import { escapeHtml } from "./email";

/**
 * The one look every TOR Finder email shares: a branded header, a white card,
 * an optional button and a small footer. Built from tables and inline styles
 * because that is what Gmail, Outlook and phone mail apps all render the same.
 */

/** The app's accent (frontend globals.css --color-accent). */
const ACCENT = "#e11d48";
const INK = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const PAGE = "#f4f4f5";
const FONT = "'Noto Sans Thai','Sarabun',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type EmailTone = "neutral" | "success" | "danger";

const TONE_COLOR: Record<EmailTone, string> = {
  neutral: ACCENT,
  success: "#16a34a",
  danger: "#dc2626",
};

export type EmailContent = {
  heading: string;
  paragraphs: string[];
  /** Label/value rows shown in a grey box, e.g. ["บริษัท", "บริษัท abc จำกัด"]. */
  details?: [string, string][];
  button?: { label: string; url: string };
  /** Small grey text under the button — expiry, "if this wasn't you", etc. */
  footnote?: string;
  /** Colours the bar above the heading: green for good news, red for a refusal. */
  tone?: EmailTone;
};

/** Escapes, then turns bare http(s) URLs into links, so a notice can mention a page inline. */
function linkify(text: string): string {
  return escapeHtml(text).replace(
    /https?:\/\/[^\s<]+[^\s<.,)]/g,
    (url) => `<a href="${url}" style="color:${ACCENT};text-decoration:underline">${url}</a>`,
  );
}

export function renderEmail({ heading, paragraphs, details, button, footnote, tone = "neutral" }: EmailContent): {
  html: string;
  text: string;
} {
  const paragraphHtml = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${INK}">${linkify(p)}</p>`)
    .join("");

  const detailsHtml = details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:${PAGE};border-radius:8px">
        ${details
          .map(
            ([label, value]) => `<tr>
              <td style="padding:10px 16px;font-size:13px;color:${MUTED};width:30%;vertical-align:top">${escapeHtml(label)}</td>
              <td style="padding:10px 16px;font-size:14px;color:${INK};font-weight:600">${escapeHtml(value)}</td>
            </tr>`,
          )
          .join("")}
      </table>`
    : "";

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px">
        <tr><td style="border-radius:8px;background:${ACCENT}">
          <a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(button.label)}</a>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:${MUTED}">ถ้ากดปุ่มไม่ได้ คัดลอกลิงก์นี้ไปเปิดในเบราว์เซอร์:<br><a href="${escapeHtml(button.url)}" style="color:${MUTED};word-break:break-all">${escapeHtml(button.url)}</a></p>`
    : "";

  const footnoteHtml = footnote
    ? `<p style="margin:8px 0 0;padding-top:16px;border-top:1px solid ${BORDER};font-size:13px;line-height:1.6;color:${MUTED}">${linkify(footnote)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="th">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:${PAGE};font-family:${FONT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
        <tr><td style="padding:0 4px 16px">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;height:28px;border-radius:6px;background:${ACCENT};color:#ffffff;font-weight:700;font-size:15px;text-align:center;vertical-align:middle">T</td>
            <td style="padding-left:10px;font-size:16px;font-weight:700;color:${INK}">TOR Finder</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden">
          <div style="height:4px;background:${TONE_COLOR[tone]}"></div>
          <div style="padding:28px 32px">
            <h1 style="margin:0 0 16px;font-size:20px;line-height:1.4;color:${INK}">${escapeHtml(heading)}</h1>
            ${paragraphHtml}
            ${detailsHtml}
            ${buttonHtml}
            ${footnoteHtml}
          </div>
        </td></tr>
        <tr><td style="padding:16px 4px;font-size:12px;line-height:1.6;color:${MUTED};text-align:center">
          อีเมลนี้ส่งอัตโนมัติจาก TOR Finder กรุณาอย่าตอบกลับ
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    heading,
    ...paragraphs,
    ...(details ?? []).map(([label, value]) => `${label}: ${value}`),
    ...(button ? [`${button.label}: ${button.url}`] : []),
    ...(footnote ? [footnote] : []),
    "—\nอีเมลนี้ส่งอัตโนมัติจาก TOR Finder กรุณาอย่าตอบกลับ",
  ].join("\n\n");

  return { html, text };
}
