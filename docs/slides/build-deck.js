// Builds the TorFinder security presentation (draft) from docs/security/project-document.md.
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const lu = require("react-icons/lu");
const { applyTheme } = require(process.env.PPTX_SKILL + "/scripts/apply_theme.js");

const OUT = process.argv[2];
const DIAGRAM = process.argv[3];

const THEME = {
  name: "TorFinder Security",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "13201F", lt1: "FFFFFF", dk2: "0B3D3A", lt2: "EEF4F3",
    accent1: "E4572E", accent2: "1F7A72", accent3: "8AA3A0",
    accent4: "F2B134", accent5: "2E5AA8", accent6: "4A6B68",
    hlink: "2E5AA8", folHlink: "4A6B68",
  },
};
const HEX = THEME.colors;
const MONO = "Courier New";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "TorFinder: Security Project";
pres.subject = "Software Development Security (01219325)";
const C = pres.SchemeColor;
const W = 13.333;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.1, w: 11.7, h: 1.3, fontSize: 54, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.55, w: 11.7, h: 0.9, fontSize: 22, color: C.accent3, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  margin: [0.5, 0.6, 0.7, 0.6],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 9.6, h: 0.95, fontSize: 34, bold: true, color: C.text2, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: "TorFinder  ·  Software Development Security (01219325)", options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 12.23, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.accent6, align: "right" },
});

// ---------- helpers ----------
async function icon(name, hex, size = 256) {
  const svg = renderToStaticMarkup(React.createElement(lu[name], { color: "#" + hex, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
async function circleIcon(slide, name, x, y, d, bg, fgHex, bgTransparency = 0) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: bg, transparency: bgTransparency }, line: { type: "none" }, objectName: "icon-circle" });
  const pad = d * 0.24;
  slide.addImage({ data: await icon(name, fgHex), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, objectName: "icon-" + name, altText: "" });
}
/** Criterion chips, top right: the graded criteria this slide covers. */
function chips(slide, list) {
  const w = 0.78, gap = 0.12;
  let x = W - 0.6 - list.length * w - (list.length - 1) * gap;
  for (const c of list) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 0.62, w, h: 0.42, rectRadius: 0.21, fill: { color: C.accent1, transparency: 88 }, line: { color: C.accent1, width: 1 }, objectName: "chip" });
    slide.addText(c, { x, y: 0.62, w, h: 0.42, fontSize: 14, bold: true, color: C.accent1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "chip-text" });
    x += w + gap;
  }
}
function card(slide, x, y, w, h, opts = {}) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: opts.fill ?? C.background2, transparency: opts.transparency ?? 0 }, line: opts.line ? { color: opts.line, width: 1 } : { type: "none" }, objectName: opts.name ?? "card" });
}
function bullets(items, size = 15) {
  return items.map((t, i) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < items.length - 1, paraSpaceAfter: 6, fontSize: size } }));
}
function content(title, section, crit) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  if (crit) chips(s, crit);
  return s;
}

(async () => {
  // ================= 1. Title =================
  pres.addSection({ title: "Introduction" });
  {
    const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Introduction" });
    await circleIcon(s, "LuShieldCheck", 0.8, 0.9, 0.95, C.accent1, "FFFFFF");
    s.addText("TorFinder", { placeholder: "title" });
    s.addText("Hardening a procurement-matching web app with OWASP ASVS 5.0", { placeholder: "body" });
    s.addText([
      { text: "Sai Khun Main  ·  Nisara Ploysuttipol  ·  Bhumipat Kusalatham", options: { breakLine: true } },
      { text: "Software Development Security (01219325)  ·  23 November 2026" },
    ], { x: 0.8, y: 5.6, w: 11.7, h: 0.9, fontSize: 16, color: C.background1, margin: 0, paraSpaceAfter: 4, isTextBox: true });
    s.addNotes("Introduce the team and the goal: we took an existing app, TorFinder, and hardened it against OWASP ASVS 5.0, Level 1 fully and most of Level 2.");
  }

  // ================= 2. What TorFinder is =================
  {
    const s = content("What TorFinder does", "Introduction");
    s.addText("Collects Bangkok government software procurement announcements (TORs) and matches them to companies that could bid.", { x: 0.6, y: 1.45, w: 12.1, h: 0.6, fontSize: 17, color: C.text1, margin: 0, isTextBox: true });
    const roles = [
      ["LuSearch", "Public visitor", "Search TORs, AI summary, budget insight, comment on drafts"],
      ["LuEye", "Viewer", "Google sign-in only; bookmarks and saved searches"],
      ["LuBuilding2", "Organization", "Company profile, ranked matches, alerts, proposal library"],
      ["LuLandmark", "Project owner", "Agency dashboard: its TORs, match counts, feedback"],
      ["LuSearchCheck", "Auditor", "TORs flagged for unusual budget or low competition"],
      ["LuUserCog", "Admin", "Approve companies, manage roles, moderate, audit log"],
    ];
    const cw = 3.85, ch = 1.95, gx = 0.28, gy = 0.3, x0 = 0.6, y0 = 2.35;
    for (let i = 0; i < roles.length; i++) {
      const [ic, name, desc] = roles[i];
      const x = x0 + (i % 3) * (cw + gx), y = y0 + Math.floor(i / 3) * (ch + gy);
      card(s, x, y, cw, ch);
      await circleIcon(s, ic, x + 0.3, y + 0.3, 0.62, C.text2, "FFFFFF");
      s.addText(name, { x: x + 1.08, y: y + 0.3, w: cw - 1.3, h: 0.62, fontSize: 18, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
      s.addText(desc, { x: x + 0.3, y: y + 1.05, w: cw - 0.6, h: 0.75, fontSize: 14, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    }
    s.addText("Next.js 16 · NestJS 11 · MongoDB 7 · Docker Compose · Google sign-in · Resend, LINE, Slack · Vertex AI", { x: 0.6, y: 6.6, w: 12.1, h: 0.3, fontSize: 12, color: C.accent6, margin: 0, isTextBox: true });
    s.addNotes("Six roles, each with its own pages. That matters for security: most of our authorization work is about keeping these roles apart.");
  }

  // ================= 3. Architecture =================
  {
    const s = content("One trust boundary, two enforcement points", "Introduction");
    // diagram is 1280 x 568
    const dw = 12.1, dh = dw * 568 / 1280;
    s.addImage({ path: DIAGRAM, x: 0.6, y: 1.55, w: dw, h: dh, altText: "Architecture: the browser reaches only the Next.js frontend; it forwards to the NestJS API on the same host, which alone talks to MongoDB and external services.", objectName: "architecture-diagram" });
    s.addNotes("The browser only ever talks to the Next.js frontend. The backend and the database listen on 127.0.0.1 only. The frontend's proxy sets CSP and cookies and gates pages by role; the backend enforces everything again: role guards, own-data queries, validation, rate limits and logging.");
  }

  // ================= 4. Process =================
  pres.addSection({ title: "Approach" });
  {
    const s = content("How we worked", "Approach");
    const steps = [
      ["LuListChecks", "ASVS review", "Every L1 and L2 requirement, one by one", "16–18 Nov"],
      ["LuRadar", "Threat model", "STRIDE on a data-flow diagram, scored", "16 Nov"],
      ["LuTarget", "Fix by priority", "Critical first, one PR per fix", "16–18 Nov"],
      ["LuBug", "SAST + DAST", "CodeQL, Semgrep, OWASP ZAP", "17 Nov"],
      ["LuTestTube", "Regression tests", "End-to-end tests in CI on every PR", "Every PR"],
    ];
    const n = steps.length, sw = 2.2, gap = (12.13 - n * sw) / (n - 1), y = 2.3;
    s.addShape(pres.shapes.LINE, { x: 0.6 + sw / 2, y: y + 0.45, w: 12.13 - sw, h: 0, line: { color: C.accent3, width: 2 }, objectName: "timeline" });
    for (let i = 0; i < n; i++) {
      const [ic, name, desc, when] = steps[i];
      const x = 0.6 + i * (sw + gap);
      await circleIcon(s, ic, x + sw / 2 - 0.45, y, 0.9, i === 2 ? C.accent1 : C.text2, "FFFFFF");
      s.addText(when, { x, y: y + 1.05, w: sw, h: 0.35, fontSize: 12, color: C.accent1, bold: true, align: "center", margin: 0, isTextBox: true });
      s.addText(name, { x, y: y + 1.4, w: sw, h: 0.45, fontSize: 18, bold: true, color: C.text2, align: "center", margin: 0, isTextBox: true });
      s.addText(desc, { x, y: y + 1.85, w: sw, h: 0.8, fontSize: 14, color: C.text1, align: "center", valign: "top", margin: 0, isTextBox: true });
    }
    card(s, 0.6, 5.55, 12.13, 0.95);
    s.addText([
      { text: "Every fix: ", options: { bold: true, color: C.text2 } },
      { text: "a test that fails before it  →  the fix  →  re-run the scanners  →  check the logs hold no passwords or tokens" },
    ], { x: 0.9, y: 5.55, w: 11.6, h: 0.95, fontSize: 16, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("Our loop: review against ASVS, model threats, fix by priority, then prove it with scanners and tests. Every fix came with a test that failed before it.");
  }

  // ================= 5. ASVS results =================
  pres.addSection({ title: "Security features" });
  {
    const s = content("ASVS 5.0: Level 1 complete, Level 2 at 76%", "Security features", ["C1"]);
    const stat = (x, big, label, color) => {
      s.addText(big, { x, y: 1.75, w: 3.6, h: 1.15, fontSize: 66, bold: true, color, fontFace: "Cambria", margin: 0, isTextBox: true });
      s.addText(label, { x, y: 2.9, w: 3.6, h: 0.7, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true });
    };
    stat(0.6, "0", "Fail or Partial at Level 1 (56 of 56 applicable pass)", C.accent1);
    s.addText("76%", { x: 0.6, y: 3.85, w: 3.6, h: 1.15, fontSize: 66, bold: true, color: C.text2, fontFace: "Cambria", margin: 0, isTextBox: true });
    s.addText("of applicable Level 2 requirements pass (93 of 123)", { x: 0.6, y: 5.0, w: 3.6, h: 0.7, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true });
    s.addChart(pres.charts.BAR, [
      { name: "Pass", labels: ["Level 1", "Level 2"], values: [56, 93] },
      { name: "Partial", labels: ["Level 1", "Level 2"], values: [0, 20] },
      { name: "Not done", labels: ["Level 1", "Level 2"], values: [0, 7] },
    ], {
      x: 4.7, y: 1.6, w: 8.0, h: 4.3, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 60,
      chartColors: [HEX.accent2, HEX.accent4, HEX.accent1],
      showValue: true, dataLabelPosition: "ctr", dataLabelColor: "FFFFFF", dataLabelFontSize: 14, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#;;",
      showLegend: true, legendPos: "b", legendFontSize: 13, legendFontFace: "+mn-lt", legendColor: HEX.dk1,
      catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 15, catAxisLabelFontFace: "+mn-lt", catAxisOrientation: "maxMin",
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showTitle: true, title: "Applicable requirements by result", titleFontSize: 14, titleColor: HEX.accent6, titleFontFace: "+mn-lt",
    });
    s.addText("Not applicable: 12 (L1), 60 (L2). Every Partial names its gap in asvs-l2.md.", { x: 4.7, y: 6.0, w: 8.0, h: 0.35, fontSize: 12, color: C.accent6, margin: 0, isTextBox: true });
    s.addNotes("We reviewed all 70 Level 1 and 183 Level 2 requirements. Level 1 has no Fail and no Partial. At Level 2, 93 of the 123 that apply pass; each Partial and Not done names its gap in the report.");
  }

  // ================= 6. Sign-in =================
  {
    const s = content("Sign-in: passwords and Google", "Security features", ["C4", "C5"]);
    const col = async (x, ic, head, items) => {
      card(s, x, 1.6, 5.95, 4.0);
      await circleIcon(s, ic, x + 0.35, 1.9, 0.7, C.text2, "FFFFFF");
      s.addText(head, { x: x + 1.25, y: 1.9, w: 4.4, h: 0.7, fontSize: 22, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
      s.addText(bullets(items, 16), { x: x + 0.35, y: 2.85, w: 5.3, h: 3.5, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    };
    await col(0.6, "LuKeyRound", "Password sign-in", [
      "Hashed with scrypt; 8–128 characters, no composition rules",
      "Refuses the 10,000 most common breached passwords and context words (torfinder, bangkok, company name)",
      "Email must be verified before the first sign-in",
      "Changing it needs the current password and ends every session",
    ]);
    await col(6.78, "LuFingerprint", "Google sign-in (OpenID Connect)", [
      "ID token signature, audience and expiry checked on the server",
      "An existing account is linked only when Google marks the email verified",
      "Viewer accounts exist only through Google: no password to steal",
    ]);
    s.addNotes("Criterion 4 and 5. Passwords follow ASVS V6: length over composition, breached-password check, verified email. Google tokens are verified server-side, never trusted from the client.");
  }

  // ================= 7. Authorization =================
  {
    const s = content("Each role sees only its own pages and data", "Security features", ["C6", "C7"]);
    const head = ["", "Public pages", "Company workspace", "Owner console", "Auditor console", "Admin console"];
    const rows = [
      ["Guest", "✓", "–", "–", "–", "–"],
      ["Viewer", "✓", "–", "–", "–", "–"],
      ["Organization", "✓", "✓", "–", "–", "–"],
      ["Project owner", "✓", "search only", "✓", "–", "–"],
      ["Auditor", "✓", "–", "–", "✓", "–"],
      ["Admin", "✓", "–", "–", "–", "✓"],
    ];
    const cell = (t, isHead, col) => ({
      text: t,
      options: {
        bold: isHead || col === 0, fontSize: isHead ? 13 : 15, align: col === 0 ? "left" : "center", valign: "middle",
        color: isHead ? C.background1 : t === "✓" ? C.accent2 : t === "–" ? C.accent3 : C.text1,
        fill: { color: isHead ? C.text2 : C.background1 },
      },
    });
    s.addTable([head.map((t, i) => cell(t, true, i)), ...rows.map((r) => r.map((t, i) => cell(t, false, i)))], {
      x: 0.6, y: 1.6, w: 7.4, colW: [1.6, 1.1, 1.3, 1.1, 1.1, 1.2], rowH: 0.56, border: { type: "solid", pt: 0.75, color: HEX.lt2 }, margin: 0.06,
    });
    card(s, 8.35, 1.6, 4.38, 4.95);
    s.addText(bullets([
      "One role guard per backend route; a guard admits only the roles it names",
      "Admin is not implicitly owner or auditor",
      "Account data is always filtered by the session's user id, never a request field",
      "Company files re-checked for ownership on every download",
      "Frontend redirects mirror the backend; the backend stays the authority",
    ], 15), { x: 8.65, y: 1.85, w: 3.85, h: 4.5, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    s.addText("Pages per role after the access-separation fix; the API refuses the same requests with 403/404.", { x: 0.6, y: 5.65, w: 7.4, h: 0.6, fontSize: 12, color: C.accent6, margin: 0, isTextBox: true });
    s.addNotes("Criterion 6 is roles, criterion 7 is own data only. The table is what each role can open. The backend enforces the same with guards and user-id filters, so even a crafted request gets 403 or 404.");
  }

  // ================= 8. Input + CORS =================
  {
    const s = content("Untrusted input stops at the edge", "Security features", ["C8", "C10"]);
    const items = [
      ["LuFilter", "Whitelisting DTOs", "class-validator with whitelist: true drops unknown fields"],
      ["LuShieldAlert", "NoSQL injection", "Typed filters with $eq; $regex input escaped"],
      ["LuFileCheck", "Uploads", "Typed by their bytes (magic numbers), size-limited"],
      ["LuGitBranch", "Request paths", "Frontend → backend paths built only from ObjectIds"],
    ];
    for (let i = 0; i < items.length; i++) {
      const [ic, head, desc] = items[i];
      const y = 1.65 + i * 1.18;
      await circleIcon(s, ic, 0.6, y, 0.7, C.text2, "FFFFFF");
      s.addText(head, { x: 1.55, y, w: 5.2, h: 0.38, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
      s.addText(desc, { x: 1.55, y: y + 0.4, w: 5.2, h: 0.6, fontSize: 15, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    }
    card(s, 7.2, 1.6, 5.53, 4.95, { fill: C.text2 });
    s.addText("CORS", { x: 7.55, y: 1.85, w: 4.8, h: 0.45, fontSize: 20, bold: true, color: C.background1, margin: 0, isTextBox: true });
    s.addText([
      { text: "app.enableCors({", options: { breakLine: true } },
      { text: "  origin: env.frontendOrigin,", options: { breakLine: true } },
      { text: "});" },
    ], { x: 7.55, y: 2.45, w: 4.9, h: 1.2, fontSize: 16, fontFace: MONO, color: C.accent4, margin: 0, isTextBox: true });
    s.addText(bullets([
      "Exactly one origin: the frontend's. Never *",
      "The backend accepts bearer tokens only, no cookies, so a cross-site request carries no credentials",
    ], 15), { x: 7.55, y: 3.9, w: 4.9, h: 2.4, color: C.background1, valign: "top", margin: 0, isTextBox: true });
    s.addNotes("Criterion 8: every request body passes a whitelisting DTO, Mongo filters are typed, and regex input is escaped. Criterion 10: CORS allows exactly one origin, and since the backend takes no cookies a cross-site call has nothing to ride on.");
  }

  // ================= 9. Secrets, errors, logging =================
  {
    const s = content("Secrets, errors and logs", "Security features", ["C9", "C11", "C12"]);
    const cols = [
      ["LuLock", "Secrets", ["Only from environment variables", "Production refuses a missing, published or short SESSION_SECRET", ".env ignored by git and Docker", "All 372 commits scanned: no real secret"]],
      ["LuCircleAlert", "Errors", ["Unexpected errors return a generic message and an errorId", "Full error stays in the server log", "Error pages never show the message"]],
      ["LuScrollText", "Security logging", ["JSON events: sign-ins, lockouts, password changes, refused access, 429s", "Time and client IP on every event", "Never passwords or tokens"]],
    ];
    const cw = 3.9, gap = 0.215;
    for (let i = 0; i < 3; i++) {
      const [ic, head, items] = cols[i];
      const x = 0.6 + i * (cw + gap);
      card(s, x, 1.6, cw, 3.7);
      await circleIcon(s, ic, x + 0.3, 1.85, 0.62, C.text2, "FFFFFF");
      s.addText(head, { x: x + 1.05, y: 1.85, w: cw - 1.3, h: 0.62, fontSize: 19, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
      s.addText(bullets(items, 14), { x: x + 0.3, y: 2.65, w: cw - 0.55, h: 2.55, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    }
    card(s, 0.6, 5.5, 12.13, 1.0, { fill: C.text2 });
    s.addText('{"event":"rate.limited","outcome":"failure","ip":"203.0.113.7","path":"/api/auth/login"}', { x: 0.9, y: 5.5, w: 11.6, h: 1.0, fontSize: 14, fontFace: MONO, color: C.accent4, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("Criteria 9, 11 and 12. The bottom line is the shape of a real security log event, the one we show in the demo after the lockout.");
  }

  // ================= 10. Headers =================
  {
    const s = content("HTTP security headers on every response", "Security features", ["C13"]);
    const rows = [
      ["Content-Security-Policy", "Per-request nonce with 'strict-dynamic'; strict fallback CSP on every other response"],
      ["Strict-Transport-Security", "max-age of 1 year"],
      ["X-Content-Type-Options", "nosniff"],
      ["frame-ancestors (CSP)", "'self': no clickjacking from other sites"],
      ["Referrer-Policy", "strict-origin-when-cross-origin"],
      ["Backend", "helmet() defaults on the API"],
    ];
    s.addTable(rows.map((r, i) => [
      { text: r[0], options: { fontFace: MONO, fontSize: 15, bold: true, color: C.text2, fill: { color: i % 2 ? C.background1 : C.background2 }, valign: "middle" } },
      { text: r[1], options: { fontSize: 15, color: C.text1, fill: { color: i % 2 ? C.background1 : C.background2 }, valign: "middle" } },
    ]), { x: 0.6, y: 1.6, w: 8.6, colW: [3.6, 5.0], rowH: 0.68, border: { type: "none" }, margin: 0.12 });
    card(s, 9.55, 1.6, 3.18, 4.08, { fill: C.accent1, transparency: 90 });
    await circleIcon(s, "LuMonitorCheck", 9.85, 1.9, 0.7, C.accent1, "FFFFFF");
    s.addText("In the demo", { x: 9.85, y: 2.75, w: 2.6, h: 0.45, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
    s.addText("Open devtools → Network → any page → Response headers.", { x: 9.85, y: 3.25, w: 2.65, h: 2.2, fontSize: 15, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    s.addNotes("Criterion 13. Set in frontend/src/proxy.ts and next.config.ts. DAST found one gap, a missing script CSP on some 404s, and we fixed it.");
  }

  // ================= 11. Advanced features =================
  {
    const s = content("Six advanced features (four required)", "Security features", ["C18"]);
    const tiles = [
      ["5 / min", "Login rate limit", "Per IP on auth routes; 10 failures in 15 min lock that email"],
      ["100 / min", "API rate limit", "Per IP; tighter on find-similar (30), AI drafts (5), LINE webhook (300)"],
      ["30 min", "Login timeout", "Idle sign-out; 7-day absolute limit whatever the activity"],
      ["HMAC", "Token expiry and revocation", "Checked on every request; revoked at logout, password or role change"],
      ["10,000", "Breached-password check", "Most common breached passwords refused at signup, reset and change"],
      ["24 h", "Email verification", "Single-use link, stored only as a hash"],
    ];
    const cw = 3.9, ch = 2.35, gx = 0.215, gy = 0.25;
    for (let i = 0; i < tiles.length; i++) {
      const [big, head, desc] = tiles[i];
      const x = 0.6 + (i % 3) * (cw + gx), y = 1.6 + Math.floor(i / 3) * (ch + gy);
      card(s, x, y, cw, ch);
      s.addText(big, { x: x + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.8, fontSize: 36, bold: true, fontFace: "Cambria", color: C.accent1, margin: 0, isTextBox: true });
      s.addText(head, { x: x + 0.3, y: y + 1.0, w: cw - 0.6, h: 0.4, fontSize: 17, bold: true, color: C.text2, margin: 0, isTextBox: true });
      s.addText(desc, { x: x + 0.3, y: y + 1.42, w: cw - 0.6, h: 0.85, fontSize: 14, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    }
    s.addNotes("The assignment asks for four self-studied features; we have six, all from the list: login and API rate limits, login timeout, token expiry management, compromised-password check and email verification.");
  }

  // ================= 12. Threat model =================
  pres.addSection({ title: "Threat model" });
  {
    const s = content("Threat model: 36 threats, 35 mitigated", "Threat model", ["C2", "C16"]);
    s.addText("35 / 36", { x: 0.6, y: 1.65, w: 4.6, h: 1.2, fontSize: 66, bold: true, fontFace: "Cambria", color: C.accent2, margin: 0, isTextBox: true });
    s.addText("mitigated; the last one is Low and partly mitigated (E3)", { x: 0.6, y: 2.85, w: 4.4, h: 0.7, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true });
    s.addText(bullets([
      "STRIDE on a data-flow diagram with 3 trust boundaries",
      "Score = likelihood × impact (1–3 each): 9 Critical, 6 High, 3–4 Medium, 1–2 Low",
      "Done/not-done checklist and code per threat in threat-model.md",
    ], 15), { x: 0.6, y: 3.75, w: 4.4, h: 2.7, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    s.addChart(pres.charts.BAR, [
      { name: "Mitigated", labels: ["Critical", "High", "Medium", "Low"], values: [3, 15, 12, 5] },
      { name: "Partly mitigated", labels: ["Critical", "High", "Medium", "Low"], values: [0, 0, 0, 1] },
    ], {
      x: 5.4, y: 1.6, w: 7.33, h: 4.9, barDir: "col", barGrouping: "stacked", barGapWidthPct: 55,
      chartColors: [HEX.accent2, HEX.accent4],
      showValue: true, dataLabelPosition: "ctr", dataLabelColor: "FFFFFF", dataLabelFontSize: 14, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#;;",
      showLegend: true, legendPos: "b", legendFontSize: 13, legendFontFace: "+mn-lt", legendColor: HEX.dk1,
      catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt",
      valAxisHidden: true, valGridLine: { style: "none" }, catGridLine: { style: "none" },
      showTitle: true, title: "Threats by priority", titleFontSize: 14, titleColor: HEX.accent6, titleFontFace: "+mn-lt",
    });
    s.addNotes("Criterion 2 and 16. STRIDE, scored by likelihood times impact. Every Critical and High threat is mitigated; only one Low threat is partial.");
  }

  // ================= 13. By priority =================
  {
    const s = content("Implemented in priority order", "Threat model", ["C2", "C16"]);
    const levels = [
      ["Critical", C.accent1, "Forged admin session with the public dev secret: production refuses it (S1)  ·  Admin password in the README: demo seeding opt-in (S3)  ·  Role guards re-checked on every route (E1)"],
      ["High", C.text2, "Public feedback leak (I1)  ·  CI dependency audit (D4)  ·  Per-IP and per-email login limits (S2, D1)  ·  Ports on localhost (E4)  ·  Git-history secret scan (I4)  ·  LINE signatures (S7)  ·  Upload checks (T6, I8)"],
      ["Medium", C.accent2, "Security logging and error messages (R1, I3)  ·  Request-forgery path checks found by SAST (T5)  ·  Upload size limits (D5)"],
      ["Low", C.accent6, "LINE webhook rate limit (D6)  ·  Left: a host allowlist for document fetches (E3)"],
    ];
    for (let i = 0; i < levels.length; i++) {
      const [name, color, text] = levels[i];
      const y = 1.6 + i * 1.25;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 1.9, h: 1.05, rectRadius: 0.12, fill: { color }, line: { type: "none" }, objectName: "priority-" + name });
      s.addText(name, { x: 0.6, y, w: 1.9, h: 1.05, fontSize: 19, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
      card(s, 2.7, y, 10.03, 1.05);
      s.addText(text, { x: 2.95, y, w: 9.6, h: 1.05, fontSize: 14, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
    }
    s.addNotes("We fixed in priority order: the three Critical threats first, all in the first PR; then High, Medium and Low. The only item left is E3, an allowlist of portal hosts for document fetches.");
  }

  // ================= 14. Principles =================
  {
    const s = content("Security design principles in the code", "Threat model", ["C3"]);
    const tiles = [
      ["Least privilege", "One role per guard; containers run as node, not root"],
      ["Complete mediation", "Every request re-checks signature, expiry, idle time, role, revocation"],
      ["Fail securely", "A bad secret stops startup; any token error means signed out"],
      ["Secure defaults", "Demo accounts off; __Host- Secure httpOnly cookie"],
      ["Defense in depth", "IP throttle plus email lockout; type allowlist plus magic bytes"],
      ["Never trust input", "Server-side DTOs; files typed by their bytes"],
      ["Minimize attack surface", "Debug route deleted; ports on 127.0.0.1; no cookies on the API"],
      ["Psychological acceptability", "No composition rules; password managers welcome"],
    ];
    const cw = 2.92, ch = 2.3, gx = 0.15, gy = 0.25;
    for (let i = 0; i < tiles.length; i++) {
      const [head, desc] = tiles[i];
      const x = 0.6 + (i % 4) * (cw + gx), y = 1.6 + Math.floor(i / 4) * (ch + gy);
      card(s, x, y, cw, ch);
      s.addText(String(i + 1).padStart(2, "0"), { x: x + 0.25, y: y + 0.2, w: 1, h: 0.4, fontSize: 14, bold: true, color: C.accent1, margin: 0, isTextBox: true });
      s.addText(head, { x: x + 0.25, y: y + 0.6, w: cw - 0.45, h: 0.65, fontSize: 17, bold: true, color: C.text2, valign: "top", margin: 0, isTextBox: true });
      s.addText(desc, { x: x + 0.25, y: y + 1.25, w: cw - 0.45, h: 0.95, fontSize: 14, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    }
    s.addText("All 12 principles with code references: threat-model.md § Security design principles", { x: 0.6, y: 6.55, w: 12.1, h: 0.3, fontSize: 12, color: C.accent6, margin: 0, isTextBox: true });
    s.addNotes("Criterion 3. Eight of our twelve principles; the document maps each to the code.");
  }

  // ================= 15. Testing =================
  pres.addSection({ title: "Testing" });
  {
    const s = content("Security testing", "Testing", ["C14", "C15"]);
    const cols = [
      ["44 → 0", "SAST", "CodeQL on every PR + Semgrep: 34 real findings fixed, 10 false positives explained"],
      ["5,573", "DAST", "OWASP ZAP baseline and signed-in active scan; 1 real finding (CSP on some 404s), fixed"],
      ["718", "Regression tests", "Backend end-to-end tests pass against a real MongoDB on every PR"],
      ["0", "Dependency risk", "npm audit fails CI on any high or critical advisory; Dependabot keeps pins current"],
    ];
    const cw = 2.92, gx = 0.15;
    for (let i = 0; i < cols.length; i++) {
      const [big, head, desc] = cols[i];
      const x = 0.6 + i * (cw + gx);
      card(s, x, 1.6, cw, 3.6);
      s.addText(big, { x: x + 0.25, y: 1.8, w: cw - 0.5, h: 1.0, fontSize: 44, bold: true, fontFace: "Cambria", color: i === 0 ? C.accent1 : C.text2, margin: 0, isTextBox: true });
      s.addText(head, { x: x + 0.25, y: 2.85, w: cw - 0.5, h: 0.45, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true });
      s.addText(desc, { x: x + 0.25, y: 3.35, w: cw - 0.5, h: 1.75, fontSize: 14, color: C.text1, valign: "top", margin: 0, isTextBox: true });
    }
    await circleIcon(s, "LuRefreshCw", 0.6, 5.55, 0.8, C.accent1, "FFFFFF");
    s.addText([
      { text: "Verified: ", options: { bold: true, color: C.text2 } },
      { text: "Semgrep re-scan 0 findings, CodeQL 0 open alerts on main, ZAP baseline re-run, and a full test run's log searched for passwords and tokens (none)." },
    ], { x: 1.65, y: 5.45, w: 11.08, h: 1.0, fontSize: 15, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("Criteria 14 and 15. Reports: sast-report.md and dast-report.md. Show the CodeQL page at 0 open and the ZAP summary as screenshots.");
  }

  // ================= 16. OWASP Top 10 =================
  {
    const s = content("Mapped to the OWASP Top 10 (2025)", "Testing", ["C17"]);
    const rows = [
      ["A01", "Broken Access Control", "Role guards, own-data queries, role-separated pages"],
      ["A02", "Security Misconfiguration", "Security headers and CSP, ports on 127.0.0.1, production secret checks"],
      ["A03", "Software Supply Chain Failures", "npm audit in CI, Dependabot, actions pinned to commit SHAs"],
      ["A04", "Cryptographic Failures", "scrypt passwords, HMAC tokens, HSTS, hashed reset tokens"],
      ["A05", "Injection", "Whitelisting DTOs, $eq filters, escaped $regex"],
      ["A06", "Insecure Design", "STRIDE threat model, rate limits and lockout by design"],
      ["A07", "Authentication Failures", "Lockout, breached-password check, email verification, idle timeout"],
      ["A08", "Software or Data Integrity Failures", "LINE webhook signatures, uploads typed by their bytes"],
      ["A09", "Security Logging and Alerting Failures", "JSON security events, admin audit log"],
      ["A10", "Mishandling of Exceptional Conditions", "Global error filter, generic message + errorId, fail securely"],
    ];
    s.addTable(rows.map((r, i) => r.map((t, c) => ({
      text: t,
      options: { fontSize: 13, bold: c < 2, color: c === 0 ? C.accent1 : c === 1 ? C.text2 : C.text1, fill: { color: i % 2 ? C.background1 : C.background2 }, valign: "middle" },
    }))), { x: 0.6, y: 1.55, w: 12.13, colW: [0.75, 4.1, 7.28], rowH: 0.47, border: { type: "none" }, margin: 0.08 });
    s.addNotes("DRAFT: check this table against the OWASP Top 10 mapping task before presenting. Criterion 17 is ASVS plus Top 10; the ASVS side is slide 5.");
  }

  // ================= 17. Demo =================
  pres.addSection({ title: "Demo and close" });
  {
    const s = content("Live demo", "Demo and close");
    const steps = [
      ["Security headers in devtools", "C13"],
      ["Six wrong passwords: 429 lockout and its log line", "C12 · C18"],
      ["Organization opens /admin: redirected; API answers 403", "C6"],
      ["One company asks for another's file: 404", "C7"],
      ["Unexpected error: generic message with an errorId", "C11"],
      ["Idle session signed out (short timeout for the demo)", "C18"],
    ];
    for (let i = 0; i < steps.length; i++) {
      const [text, crit] = steps[i];
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.17, y = 1.6 + row * 1.6, w = 5.96;
      card(s, x, y, w, 1.35);
      s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.32, w: 0.7, h: 0.7, fill: { color: C.text2 }, line: { type: "none" }, objectName: "step-number" });
      s.addText(String(i + 1), { x: x + 0.25, y: y + 0.32, w: 0.7, h: 0.7, fontSize: 20, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(text, { x: x + 1.2, y: y + 0.15, w: w - 1.45, h: 0.75, fontSize: 16, bold: true, color: C.text2, valign: "middle", margin: 0, isTextBox: true });
      s.addText(crit, { x: x + 1.2, y: y + 0.88, w: w - 1.45, h: 0.35, fontSize: 13, color: C.accent1, bold: true, margin: 0, isTextBox: true });
    }
    s.addNotes("Run the demo against the local Docker stack with demo data. Keep a backup screenshot of each step in case the network or stack fails.");
  }

  // ================= 18. Close =================
  {
    const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Demo and close" });
    s.addText("Thank you", { placeholder: "title" });
    s.addText("Questions?", { placeholder: "body" });
    const items = [
      ["ASVS", "Level 1 complete, Level 2 at 76%"],
      ["Threats", "35 of 36 mitigated, all Critical and High"],
      ["Next", "Host allowlist (E3), Google nonce, stronger scrypt settings"],
    ];
    for (let i = 0; i < items.length; i++) {
      const x = 0.8 + i * 3.95;
      s.addText(items[i][0], { x, y: 5.1, w: 3.7, h: 0.4, fontSize: 14, bold: true, color: C.accent1, margin: 0, isTextBox: true });
      s.addText(items[i][1], { x, y: 5.5, w: 3.7, h: 0.9, fontSize: 16, color: C.background1, valign: "top", margin: 0, isTextBox: true });
    }
    s.addNotes("Recap the three numbers, say what is left and why it is Low risk, then take questions. Repository: github.com/PhomMaiWai/TorFinder.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
