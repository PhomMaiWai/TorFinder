// Takes the evidence screenshots in screenshots/ (issue #349). Cookie values are
// never rendered; set-cookie / cookie / authorization headers are masked.
//
// Needs the stack running locally (docker compose up -d, SEED_DEMO_DATA=true),
// Google Chrome, and Playwright in some folder of your own:
//   mkdir /tmp/pw && cd /tmp/pw && npm i playwright
//   NODE_PATH=/tmp/pw/node_modules node docs/security/evidence/capture-screenshots.js headers cors
// Shots: headers cors lockout passwords authz logs google adminsignout sessions mtls edge hardening zap crosscompany
//   (run adminsignout before sessions: it clears the company's other sessions)
//   idle      needs SESSION_IDLE_MINUTES=1 on frontend + backend (a compose override)
//   error500  needs MongoDB stopped first: docker compose stop db (start it again after)
// Run lockout and authz at least a minute apart: login is limited to 5 a minute per IP.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const path = require("path");

const REPO = path.resolve(__dirname, "../../..");
const OUT = path.join(REPO, "docs/security/evidence/screenshots");
const FE = "http://localhost:3000";
const ORG = { email: "contact@arundigital.co.th", password: "Org12345!" };
const ADMIN = { email: "admin@bma.go.th", password: "Admin1234!" };
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const VIEWPORT = { width: 1280, height: 800 };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SECRET_HEADERS = ["set-cookie", "cookie", "authorization"];
const mask = (name, value) => name.toLowerCase() === "content-security-policy" ? value.split("; ").join(";\n") : (SECRET_HEADERS.includes(name.toLowerCase()) ? value.replace(/=([^;]+)/, "=█████ (hidden)") : value);
const sh = (cmd) => execSync(cmd, { cwd: REPO, encoding: "utf8", shell: "/bin/zsh" });

/** A plain evidence card: title, where the data came from, then rows or a terminal block. */
function card({ title, source, rows, highlight = [], terminal, note }) {
  const rowHtml = (rows ?? [])
    .map(([k, v]) => {
      const hit = highlight.includes(k.toLowerCase());
      return `<tr class="${hit ? "hit" : ""}"><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`;
    })
    .join("");
  return `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:28px;font:15px/1.45 -apple-system,"Sukhumvit Set","Helvetica Neue",sans-serif;background:#f4f5f7;color:#1c1e21}
    h1{font-size:22px;margin:0 0 4px} .src{color:#5f6672;margin-bottom:16px;font-size:14px}
    table{border-collapse:collapse;width:100%;table-layout:fixed;background:#fff;border:1px solid #d9dce1;border-radius:8px;overflow:hidden}
    td{padding:7px 12px;border-top:1px solid #eceef1;vertical-align:top;font-family:ui-monospace,Menlo,monospace;font-size:13.5px;word-break:break-all;white-space:pre-wrap}
    td.k{width:290px;color:#8a1538;font-weight:600} tr.hit td{background:#fff6d6}
    pre{background:#15171c;color:#e6e6e6;padding:16px 18px;border-radius:8px;font:13.5px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;margin:0 0 14px}
    pre .c{color:#7ee787} pre .h{background:#5a4a00;color:#ffe680}
    .note{margin-top:14px;color:#5f6672;font-size:13.5px}
  </style><h1>${esc(title)}</h1><div class="src">${esc(source)}</div>
  ${terminal ?? ""}${rows ? `<table>${rowHtml}</table>` : ""}${note ? `<div class="note">${esc(note)}</div>` : ""}`;
}

/** A terminal block: `$ cmd` in green, then output with matching lines highlighted. */
function term(cmd, output, hl = []) {
  const lines = output
    .trimEnd()
    .split("\n")
    .map((l) => (hl.some((h) => l.toLowerCase().includes(h.toLowerCase())) ? `<span class="h">${esc(l)}</span>` : esc(l)))
    .join("\n");
  return `<pre><span class="c">$ ${esc(cmd)}</span>\n${lines}</pre>`;
}

async function renderCard(browser, file, html) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  await page.close();
  console.log("wrote", file);
}

async function login(page, { email, password }, at = "/login/organization") {
  await page.goto(FE + at);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
}

/** Screenshot of the page with the address shown above it (headless Chrome has no URL bar). */
async function pageShot(page, file, caption) {
  const url = page.url();
  await page.evaluate(
    ([url, caption]) => {
      const bar = document.createElement("div");
      bar.setAttribute("style", "position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#202124;color:#e8eaed;font:14px/1 ui-monospace,Menlo,monospace;padding:10px 14px;display:flex;gap:16px");
      bar.innerHTML = `<span style="background:#35363a;padding:6px 10px;border-radius:14px;flex:1"></span><span style="color:#fdd663;align-self:center"></span>`;
      bar.children[0].textContent = url;
      bar.children[1].textContent = caption;
      document.body.style.paddingTop = "36px";
      document.body.appendChild(bar);
    },
    [url, caption],
  );
  await page.screenshot({ path: path.join(OUT, file) });
  console.log("wrote", file);
}

const shots = {
  // 1 + 2 + 3 share one signed-in org session.
  async headers(browser) {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await login(page, ORG);
    const doc = await page.goto(FE + "/search");
    const h = await doc.allHeaders();
    await renderCard(
      browser,
      "01-headers-search-page.png",
      card({
        title: "GET /search — response headers",
        source: `Signed in as the demo org account; headers as received by Chrome ${browser.version()} (status ${doc.status()}).`,
        rows: Object.entries(h).sort().map(([k, v]) => [k, mask(k, v)]),
        highlight: ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy", "cache-control"],
      }),
    );

    const api = await page.waitForResponse((r) => r.url().endsWith("/api/auth/me"), { timeout: 3000 }).catch(() => null);
    const me = api ?? (await page.goto(FE + "/api/auth/me"));
    const mh = await me.allHeaders();
    await renderCard(
      browser,
      "02-headers-api-auth-me.png",
      card({
        title: "GET /api/auth/me — response headers",
        source: `Same signed-in session; status ${me.status()}.`,
        rows: Object.entries(mh).sort().map(([k, v]) => [k, mask(k, v)]),
        highlight: ["cache-control", "content-type"],
      }),
    );

    const cookies = await ctx.cookies(FE);
    await renderCard(
      browser,
      "03-session-cookie-flags.png",
      card({
        title: "Session cookie — attributes",
        source: "Cookies stored by Chrome for http://localhost:3000 after signing in. Values are deliberately not shown.",
        rows: cookies.flatMap((c) => [
          [`${c.name}`, "value: (hidden)"],
          [`  └ HttpOnly`, c.httpOnly ? "✓" : "✗"],
          [`  └ Secure`, c.secure ? "✓" : "✗"],
          [`  └ SameSite`, c.sameSite],
          [`  └ Path / Domain`, `${c.path} / ${c.domain}`],
          [`  └ Expires`, c.expires > 0 ? new Date(c.expires * 1000).toISOString() : "session"],
        ]),
        highlight: ["__host-torr_session"],
      }),
    );
    await ctx.close();
  },

  async cors(browser) {
    const code = sh("grep -n -B3 -A1 'enableCors' backend/src/main.ts");
    const evil = sh(`curl -s -o /dev/null -D - -H "Origin: https://evil.example" 'http://localhost:4000/api/tor?limit=1'`);
    const good = sh(`curl -s -o /dev/null -D - -H "Origin: http://localhost:3000" 'http://localhost:4000/api/tor?limit=1'`);
    await renderCard(
      browser,
      "04-cors-allowlist.png",
      card({
        title: "CORS: only the frontend origin is allowed",
        source: "backend/src/main.ts, then the same request from a foreign origin and from the frontend's origin.",
        terminal:
          term("grep -n -B3 -A1 enableCors backend/src/main.ts", code, ["enableCors"]) +
          term('curl -s -o /dev/null -D - -H "Origin: https://evil.example" http://localhost:4000/api/tor?limit=1 | grep -i access-control', evil.split("\n").filter((l) => /access-control|^HTTP/i.test(l)).join("\n") + "\n→ the allowed origin is fixed to http://localhost:3000, not https://evil.example, so the browser refuses to hand the response to evil.example's script", ["access-control-allow-origin"]) +
          term('curl -s -o /dev/null -D - -H "Origin: http://localhost:3000" http://localhost:4000/api/tor?limit=1 | grep -i access-control', good.split("\n").filter((l) => /access-control|^HTTP/i.test(l)).join("\n"), ["access-control-allow-origin"]),
      }),
    );
  },

  // Uses a pending demo account so the lock doesn't block the other shots.
  async lockout(browser) {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(FE + "/login/organization");
    for (let i = 1; i <= 11; i++) {
      await page.fill('input[type="email"]', "hello@datacraft.co.th");
      await page.fill('input[type="password"]', `wrong-password-${i}`);
      const res = page.waitForResponse((r) => r.request().method() === "POST", { timeout: 15000 });
      await page.click('button[type="submit"]');
      await res;
      await page.waitForTimeout(800);
      const msg = await page.locator('[role="alert"]').first().innerText().catch(() => "");
      console.log(i, msg.replace(/\s+/g, " ").slice(0, 90));
      // The per-IP route throttle allows 5 logins a minute; space them out so the per-email lock is what answers.
      if (i < 11) await page.waitForTimeout(13000);
    }
    await pageShot(page, "05-login-lockout.png", "11th wrong password → locked for 15 minutes");
    await page.close();
  },

  // Needs SESSION_IDLE_MINUTES=1 on frontend+backend (see README caption).
  async idle(browser) {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await login(page, ORG);
    console.log("signed in at", page.url(), "— waiting 75 s idle");
    await page.waitForTimeout(75000);
    await page.goto(FE + "/matches");
    await page.waitForLoadState("networkidle");
    await pageShot(page, "06-idle-session-timeout.png", "after 75 s idle (SESSION_IDLE_MINUTES=1 for this shot)");
    await ctx.close();
  },

  async passwords(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
    const tries = [
      ["password123", "07a-signup-breached-password.png", "common/breached password refused"],
      ["TorFinder2026!", "07b-signup-context-password.png", "context-specific password refused"],
    ];
    for (const [pw, file, caption] of tries) {
      await page.goto(FE + "/signup/organization");
      await page.fill('input[name="email"]', "evidence@example.com");
      await page.fill('input[name="password"]', pw);
      await page.fill('input[name="confirmPassword"]', pw);
      await page.fill('input[name="companyName"]', "บริษัท ทดสอบหลักฐาน จำกัด");
      await page.fill('input[name="taxId"]', "0105561000005");
      await page.fill('input[name="contactName"]', "ผู้ทดสอบ ระบบ");
      await page.fill('input[name="phone"]', "0812345678");
      await page.fill('input[name="specialty"]', "Cloud Platform");
      await page.fill('textarea[name="address"]', "1 ถนนทดสอบ เขตทดสอบ กรุงเทพฯ 10100");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2500);
      await page.locator('input[name="password"]').scrollIntoViewIfNeeded();
      await pageShot(page, file, `password "${pw}" → ${caption}`);
    }
    await page.close();
  },

  async authz(browser) {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await login(page, ORG);
    await page.goto(FE + "/admin");
    await page.waitForLoadState("networkidle");
    await pageShot(page, "11a-org-opens-admin-redirected.png", "org account typed /admin → sent to /dashboard");
    // The token stays in memory: it is sent to the backend but never printed or rendered.
    const token = (await ctx.cookies(FE)).find((c) => c.name.endsWith("torr_session")).value;
    const res = await fetch("http://localhost:4000/api/accounts", { headers: { Authorization: `Bearer ${token}` } });
    const r = { status: `HTTP/1.1 ${res.status} ${res.statusText}`, body: await res.text() };
    const anon = sh("curl -s -i http://localhost:4000/api/accounts | grep -v -i '^\\(etag\\|date\\|x-\\|content-length\\|vary\\|keep-alive\\|connection\\|origin-agent\\|cross-origin\\|referrer\\|strict\\|content-security\\)'");
    await renderCard(
      browser,
      "11b-api-accounts-forbidden.png",
      card({
        title: "GET /api/accounts without the admin role",
        source: "First with the signed-in demo org account's session (token not shown), then with no session at all.",
        terminal:
          term('curl -s -i -H "Authorization: Bearer <org session token — hidden>" http://localhost:4000/api/accounts', `${r.status}\n${r.body}`, ["HTTP/"]) +
          term("curl -s -i http://localhost:4000/api/accounts", anon, ["HTTP/"]),
      }),
    );
    await ctx.close();
  },

  async logs(browser) {
    const out = sh(`docker compose logs --no-log-prefix backend | grep '"context":"Security"' | grep -E 'auth.login|access.denied' | tail -n 12`);
    await renderCard(
      browser,
      "08-security-log-json.png",
      card({
        title: "Structured security log (backend, JSON, one event per line)",
        source: "Produced by shots 05 and 11 above; emails are the public demo accounts.",
        terminal: term(`docker compose logs --no-log-prefix backend | grep '"context":"Security"' | grep -E 'auth.login|access.denied' | tail -n 12`, out, ['"auth.login.locked"', '"access.denied"', '"failure"']),
      }),
    );
  },

  // Database stopped by the caller; this records the client's answer and the server log.
  async error500(browser) {
    const resp = sh("curl -s -i --max-time 45 'http://localhost:4000/api/tor?limit=1' | grep -i -E '^HTTP|^content-type|^\\{' ; true");
    const id = (resp.match(/"errorId":"([^"]+)"/) || [])[1] ?? "";
    const log = id ? sh(`docker compose logs --no-log-prefix backend | grep '${id}' | cut -c1-1600`) : "(no errorId found)";
    await renderCard(
      browser,
      "09-generic-500-with-error-id.png",
      card({
        title: "Unexpected error: generic answer to the client, full detail only in the server log",
        source: "Triggered by stopping MongoDB (docker compose stop db) and calling a public API; db restarted afterwards.",
        terminal:
          term("docker compose stop db && curl -s -i 'http://localhost:4000/api/tor?limit=1'", resp, ["errorId"]) +
          term(`docker compose logs --no-log-prefix backend | grep ${id || "<errorId>"}`, log, [id || "zzz"]),
      }),
    );
  },

  async google(browser) {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(FE + "/login/public");
    await page.waitForTimeout(2500);
    await pageShot(page, "12a-google-sign-in-button.png", "Google sign-in (SSO) on the public login page");
    await page.close();
  },

  // 15: an admin ends one account's sessions (ASVS 7.4.5). The list is filtered to
  // the demo company, so no other account's name or email is in the picture.
  async adminsignout(browser) {
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await login(page, ADMIN, "/login/admin");
    await page.goto(FE + "/admin/users");
    await page.fill("#user-search", "arundigital");
    await page.waitForTimeout(500);
    await pageShot(page, "15a-admin-sign-out-buttons.png", "Manage Users: Sign out (one account) and Sign out everyone");
    await page.getByRole("button", { name: "ออกจากระบบทุกคน" }).click();
    await pageShot(page, "15b-admin-sign-out-everyone-confirm.png", "Sign out everyone asks to confirm first (not confirmed here)");
    await page.getByRole("button", { name: "ยกเลิก" }).first().click();
    // By its tooltip: the sidebar's own logout button has the same label.
    await page.locator('button[title="ปิดทุกเซสชันของบัญชีนี้ในทุกอุปกรณ์"]').click();
    await page.getByText("ในทุกอุปกรณ์แล้ว").waitFor();
    await pageShot(page, "15c-admin-signed-account-out.png", "Arun Digital signed out on every device");
    await ctx.close();
    const out = sh(`docker compose logs --no-log-prefix backend | grep '"admin.sessions.revoke"' | grep arundigital | tail -n 1`);
    await renderCard(
      browser,
      "15d-admin-sign-out-logged.png",
      card({
        title: "Admin sign-out is logged as a security event (ASVS 7.4.5)",
        source: "Backend log after 15c; the audit log gets the same action with the admin's email",
        terminal: term(`docker compose logs --no-log-prefix backend | grep '"admin.sessions.revoke"' | grep arundigital | tail -n 1`, out, ['"admin.sessions.revoke"']),
      }),
    );
  },

  // 14: an account sees where it is signed in and ends other sessions after its password (ASVS 7.5.2).
  // Run after adminsignout, so the company starts with no other sessions.
  async sessions(browser) {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE });
    await login(await phone.newPage(), ORG);
    const ctx = await browser.newContext({ viewport: VIEWPORT, userAgent: MAC_CHROME });
    const page = await ctx.newPage();
    await login(page, ORG);
    await page.goto(FE + "/account");
    await page.getByText("อุปกรณ์ที่เข้าสู่ระบบอยู่").scrollIntoViewIfNeeded();
    await pageShot(page, "14a-signed-in-devices.png", "/account lists each signed-in device; this one is marked");
    await page.getByRole("button", { name: "ออกจากระบบอุปกรณ์อื่นทั้งหมด" }).first().click();
    await page.getByText("ยืนยันด้วยรหัสผ่านปัจจุบัน").scrollIntoViewIfNeeded();
    await pageShot(page, "14b-end-sessions-needs-password.png", "ending other sessions asks for the password again");
    await page.fill('form input[type="password"]', "wrong-password-1");
    await page.locator("form").getByRole("button", { name: "ออกจากระบบอุปกรณ์อื่นทั้งหมด" }).click();
    await page.getByRole("status").waitFor();
    await pageShot(page, "14c-wrong-password-refused.png", "a wrong password ends nothing");
    await page.fill('form input[type="password"]', ORG.password);
    await page.locator("form").getByRole("button", { name: "ออกจากระบบอุปกรณ์อื่นทั้งหมด" }).click();
    await page.getByText("ออกจากระบบแล้ว").waitFor();
    await page.waitForTimeout(800);
    await pageShot(page, "14d-other-sessions-ended.png", "after the right password only this device is left");
    // Kept before the phone's next page, which drops it: 14f sends it again by hand.
    const [oldCookie] = (await phone.cookies()).filter((c) => c.name.endsWith("torr_session"));
    // Its next page asks the backend, which says the session is over: sign-in.
    const phonePage = await phone.newPage();
    await phonePage.goto(FE + "/matches");
    await phonePage.waitForURL((u) => u.pathname.startsWith("/login"));
    await pageShot(phonePage, "14e-phone-sent-to-sign-in.png", "the phone's next page: back to sign-in");
    // A copy of the old cookie, replayed, still gets no account data.
    const results = [];
    for (const url of ["/api/notifications", "/api/saved-tors", "/api/saved-searches"]) {
      const res = await phone.request.get(FE + url, { headers: { cookie: `${oldCookie.name}=${oldCookie.value}` } });
      results.push(`GET ${url}\n  → ${res.status()} ${(await res.text()).slice(0, 90)}`);
    }
    await renderCard(
      browser,
      "14f-ended-session-refused.png",
      card({
        title: "A copy of the ended session's cookie gets no account data (ASVS 7.5.2)",
        source: "The phone's session cookie from before 14d, sent again by hand after it was ended (its value is not shown)",
        terminal: term("# the ended session's cookie, replayed", results.join("\n"), ["401"]),
        note: "The backend checks the session on every request. The frontend also asks it on every full page load (14e) and drops the cookie once the session is over.",
      }),
    );
    await phone.close();
    await ctx.close();
  },

  // 17: the HTTPS edge (ASVS 4.1.2, 4.2.1, 12.1.2). Needs the stack started with it:
  //   EDGE_HTTP_PORT=18080 EDGE_HTTPS_PORT=18443 FRONTEND_ORIGIN=https://localhost:18443 \
  //     docker compose -f docker-compose.yml -f docker-compose.edge.yml up -d
  async edge(browser) {
    const redirects = sh(
      `curl -s -o /dev/null -w "GET /search      (a page) -> %{http_code} %{redirect_url}\n" http://localhost:18080/search; ` +
        `curl -s -w "  %{http_code}\n" http://localhost:18080/api/auth/me | sed 's|^|GET /api/auth/me (an API) -> |'`,
    );
    const framing = sh(`python3 -I docs/security/evidence/edge-framing.py`);
    const tls = sh(`docker run --rm --entrypoint sh mongo:7 -c '
for c in "-tls1_1 -cipher DEFAULT:@SECLEVEL=0" "-tls1_2 -cipher AES128-SHA:@SECLEVEL=0" "-tls1_2 -cipher AES256-GCM-SHA384" "-tls1_2 -cipher DHE-RSA-AES128-GCM-SHA256:@SECLEVEL=0" "-tls1_2 -cipher ECDHE-ECDSA-AES128-GCM-SHA256" "-tls1_3"; do
  out=$(echo | timeout 5 openssl s_client -connect host.docker.internal:18443 -servername localhost $c 2>&1)
  got=$(echo "$out" | grep -oE "Cipher is [A-Z0-9_-]+" | grep -v NONE | head -1)
  err=$(echo "$out" | grep -oE "alert [a-z ]+" | head -1)
  echo "$c -> \${got:-refused: $err}"
done'`);
    await renderCard(
      browser,
      "17-https-edge.png",
      card({
        title: "The HTTPS edge (ASVS 4.1.2, 4.2.1, 12.1.2)",
        source: "Caddy (docker/caddy/Caddyfile) in front of the frontend, run locally on ports 18080 (HTTP) and 18443 (HTTPS)",
        terminal: [
          term("# plain HTTP: pages redirect, API calls are refused (4.1.2)", redirects, ["308", "403"]),
          term("# requests with ambiguous message framing, over TLS (4.2.1)", framing, ["400", "501"]),
          term("# TLS versions and cipher suites the edge accepts (12.1.2)", tls, ["refused", "Cipher is"]),
        ].join(""),
        note: "Caddy rebuilds each request before passing it to Next.js over HTTP/1.1, so the two never disagree about where a message ends. Only forward-secret AEAD suites are accepted.",
      }),
    );
  },

  // 18: the opt-in hardening services (ASVS 5.4.3, 13.2.5, 13.3.1, 16.4.2, 16.4.3).
  // Needs: docker compose -f docker-compose.yml -f docker-compose.hardening.yml up -d --build
  async hardening(browser) {
    const H = "docker compose -f docker-compose.yml -f docker-compose.hardening.yml";
    const quiet = "2>&1 | grep -v -e UNDICI -e trace-warnings";
    const egress = sh(
      `${H} exec -T backend node -e 'const t = async (l, u) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(15000) }); console.log(l, "->", r.status); } catch (e) { console.log(l, "-> refused"); } }; (async () => { await t("https://data.go.th/   (a portal)", "https://data.go.th/"); await t("https://example.com/  (not on the list)", "https://example.com/"); })();' ${quiet}; ` +
        `${H} exec -T -e NODE_USE_ENV_PROXY=0 backend node -e 'fetch("https://data.go.th/", { signal: AbortSignal.timeout(8000) }).then((r) => console.log("https://data.go.th/   without the proxy ->", r.status)).catch((e) => console.log("https://data.go.th/   without the proxy -> refused:", e.cause?.code ?? e.message))' ${quiet}; ` +
        `${H} exec -T egress grep -E 'example.com|data.go.th' /var/log/squid/access.log | tail -n 2 | awk '{print "proxy log:", $4, $7}'`,
    );
    // Loads the vault's secrets file first, as the app itself does at start.
    const virus = sh(`${H} exec -T backend sh -c 'set -a && . /run/app-secrets/app.env && set +a && node -' < docs/security/evidence/virus-probe.js ${quiet} | grep -e "->"`);
    const logs = sh(
      `docker run --rm -v torfinder_security_logs:/logs:ro alpine sh -c 'for f in /logs/*; do echo "$(basename $f): $(wc -l < $f) lines"; done'; ` +
        `${H} config --format json | node -e 'const c = JSON.parse(require("fs").readFileSync(0)); for (const [n, s] of Object.entries(c.services)) if ((s.volumes ?? []).some((v) => v.source === "security_logs")) console.log("containers that mount the log volume:", n)'`,
    );
    const vault = sh(
      `${H} logs --no-log-prefix vault-init | tail -n 6; ` +
        `${H} exec -T backend sh -c 'echo "SESSION_SECRET from compose: [\${SESSION_SECRET}]"; ls -ln /run/app-secrets/app.env | awk "{print \"secrets file:\", \$1, \"owner uid\", \$3}"; sed "s/=.*/=<value hidden>/" /run/app-secrets/app.env'`,
    );
    await renderCard(
      browser,
      "18-hardening-services.png",
      card({
        title: "Hardening services (ASVS 5.4.3, 13.2.5, 13.3.1, 16.4.2, 16.4.3)",
        source: "docker-compose.hardening.yml on the local stack; each command runs inside the named container",
        terminal: [
          term("# 13.2.5: the backend's only way out is the allowlist proxy", egress, ["-> 200", "refused", "TCP_DENIED"]),
          term("# 5.4.3: files from outside are scanned by ClamAV", virus, ["422", "passed"]),
          term("# 16.4.2 / 16.4.3: logs go to a separate store no app container mounts", logs, ["lines", "log-store"]),
          term("# 13.3.1: secrets come from the vault, one file per service", vault, ["gave", "[]", "hidden"]),
        ].join(""),
        note: "Secret values are never shown. The vault's unseal key stays in a volume only vault-init mounts; a real server would use auto-unseal instead.",
      }),
    );
  },

  // 19: the ZAP report's summary (criterion 15): the signed-in active scan,
  // from its own HTML report, down to where the per-alert detail starts.
  async zap(browser) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await page.goto("file://" + path.join(REPO, "docs/security/evidence/zap-full.html"));
    const end = await page.locator("h3", { hasText: "Alert Detail" }).first().boundingBox();
    const height = Math.min(Math.ceil(end.y), 4000);
    await page.setViewportSize({ width: 1280, height });
    await page.screenshot({ path: path.join(OUT, "19-zap-summary.png"), clip: { x: 0, y: 0, width: 1280, height } });
    await page.close();
    console.log("wrote 19-zap-summary.png");
  },

  // 20: one company can't open another company's file (criterion 7; ASVS 8.2.2).
  // Arun Digital uploads a small test certificate; a throwaway second company
  // (temp-company.js) asks for the same file. Both are removed afterwards.
  async crosscompany(browser) {
    const helper = (action) =>
      sh(`docker compose exec -T -e ACTION=${action} backend node - < docs/security/evidence/temp-company.js`).trim().split("\n").pop();
    const other = JSON.parse(helper("create"));
    const owner = await browser.newContext({ viewport: VIEWPORT });
    const stranger = await browser.newContext({ viewport: VIEWPORT });
    const ownerPage = await owner.newPage();
    const strangerPage = await stranger.newPage();
    let certificateId;
    try {
      await login(ownerPage, ORG);
      await login(strangerPage, other);
      // Through the frontend, as the Certificates page does it.
      certificateId = await ownerPage.evaluate(async () => {
        const created = await fetch("/api/certificates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "ISO 27001 (evidence test)", standard: "iso27001" }),
        }).then((r) => r.json());
        const form = new FormData();
        form.append("file", new Blob(["%PDF-1.7\n% a test certificate\n"], { type: "application/pdf" }), "iso27001.pdf");
        const uploaded = await fetch(`/api/certificates/${created.id}/file`, { method: "PUT", body: form });
        if (!uploaded.ok) throw new Error(`upload failed: ${uploaded.status}`);
        return created.id;
      });
      const ask = (page) =>
        page.evaluate(async (id) => {
          const res = await fetch(`/api/certificates/${id}/file`);
          const type = res.headers.get("content-type") ?? "";
          return `${res.status} ${type.startsWith("application/pdf") ? "application/pdf (the file)" : (await res.text()).slice(0, 80)}`;
        }, certificateId);
      const anonymous = await browser.newContext();
      const anonymousPage = await anonymous.newPage();
      await anonymousPage.goto(FE + "/search");
      const lines = [
        `GET /api/certificates/${certificateId}/file`,
        `  as Arun Digital (the owner)   → ${await ask(ownerPage)}`,
        `  as Evidence Other Co          → ${await ask(strangerPage)}`,
        `  with no session               → ${await ask(anonymousPage)}`,
      ];
      await anonymous.close();
      await renderCard(
        browser,
        "20-cross-company-file-refused.png",
        card({
          title: "One company can't open another company's file (ASVS 8.2.2, criterion 7)",
          source: "Local stack: Arun Digital uploads a test certificate, then a second company asks for the same URL",
          terminal: term("# the same file, asked for by three callers through the frontend", lines.join("\n"), ["200", "404", "401", "403"]),
          note: "Each file is looked up together with the caller's own account (certificates.service.ts), so another company's id is simply not found: the answer gives away nothing about whether the file exists.",
        }),
      );
    } finally {
      if (certificateId) await ownerPage.evaluate((id) => fetch(`/api/certificates/${id}`, { method: "DELETE" }), certificateId);
      await owner.close();
      await stranger.close();
      console.log(helper("remove"));
    }
  },

  // 16: services authenticate each other with certificates (ASVS 12.3.3, 12.3.5).
  async mtls(browser) {
    const req = `printf "GET /api/health HTTP/1.1\\r\\nHost: backend\\r\\nConnection: close\\r\\n\\r\\n"`;
    const run = (inner) => sh(`docker compose exec -T db sh -c '${inner} 2>&1' | grep -v SSL_get_servername | head -n 3 || true`);
    const noCert = run(`${req} | timeout 5 openssl s_client -quiet -verify_quiet -connect backend:4000 -CAfile /certs/ca.crt`);
    const dbCert = run(`${req} | timeout 5 openssl s_client -quiet -verify_quiet -connect backend:4000 -CAfile /certs/ca.crt -cert /certs/db.pem`);
    const mongoPlain = run(`timeout 8 mongosh --quiet --host 127.0.0.1 --eval 1`);
    const mongoNoCert = run(`timeout 8 mongosh --quiet --host 127.0.0.1 --tls --tlsCAFile /certs/ca.crt --eval 1`);
    const boot = sh(`docker compose logs --no-log-prefix backend | grep -o 'torr-backend listening[^"]*' | tail -n 1; docker compose logs --no-log-prefix db-users | grep 'CN=torr_app' | tail -n 1`);
    await renderCard(
      browser,
      "16-mutual-tls.png",
      card({
        title: "Services authenticate each other with certificates (ASVS 12.3.3, 12.3.5)",
        source: "Local stack, docker compose; each command runs inside the database container",
        terminal: [
          term("docker compose logs backend db-users   # how they started", boot, ["client certificates required", "CN=torr_app"]),
          term("# backend over TLS with no client certificate", noCert, ["certificate required"]),
          term("# backend with a certificate from our CA that isn't the frontend's (the database's)", dbCert, ["403"]),
          term("# MongoDB without TLS", mongoPlain, ["closed"]),
          term("# MongoDB over TLS without a client certificate", mongoNoCert, ["closed"]),
        ].join(""),
        note: "Only the frontend's certificate may call the backend, and the backend signs in to MongoDB with its own certificate (MONGODB-X509), so it has no database password.",
      }),
    );
  },
};

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    for (const name of process.argv.slice(2)) await shots[name](browser);
  } finally {
    await browser.close();
  }
})();
