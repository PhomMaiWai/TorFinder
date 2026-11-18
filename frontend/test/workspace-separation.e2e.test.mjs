// The company workspace stays with company accounts. /search, a TOR opened
// with ?in=app and /saved?scope=org render inside the company sidebar (company
// profile, matches, library…); proxy.ts sends a public viewer, staff or a guest
// to the public view of the same page instead, keeping the rest of the query.
//
// Node's built-in runner + fetch against a running `next start` of this app
// (proxy redirects need the real server). Session cookies are minted the same
// way owner-page.e2e.test.mjs does; the proxy checks them without the database.
//
// Requires:
//   - E2E_FRONTEND_URL  a running `next start` of this app (default http://localhost:3000)
//   - SESSION_SECRET    must match what that process booted with

import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { describe, it } from "node:test";

const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:3000";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
/** `next start` runs in production, where the session cookie carries the __Host- prefix (src/lib/auth.ts); set E2E_SESSION_COOKIE=torr_session against `next dev`. */
const SESSION_COOKIE = process.env.E2E_SESSION_COOKIE ?? "__Host-torr_session";

function makeToken(role) {
  const iat = Math.floor(Date.now() / 1000);
  const sub = randomBytes(12).toString("hex");
  const payload = { sub, email: `workspace-e2e-${role}@ci.test`, name: `CI ${role}`, role, iat, exp: iat + 3600 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${signature}`;
}

const TOKENS = {
  viewer: makeToken("viewer"),
  org: makeToken("org"),
  owner: makeToken("owner"),
  admin: makeToken("admin"),
  auditor: makeToken("auditor"),
};

/** Where a request ends up after the proxy: the redirect target (path + query), or null when it isn't redirected. */
async function redirectOf(path, role) {
  const cookie = role ? `${SESSION_COOKIE}=${TOKENS[role]}; NEXT_LOCALE=en` : "NEXT_LOCALE=en";
  const res = await fetch(`${FRONTEND_URL}${path}`, { headers: { cookie }, redirect: "manual" });
  const location = res.headers.get("location");
  if (res.status < 300 || res.status >= 400 || !location) return null;
  const url = new URL(location, FRONTEND_URL);
  return `${url.pathname}${url.search}`;
}

// Any id will do: the proxy decides before the page looks the record up.
const TOR = "/tor/0123456789abcdef01234567";

describe("/search is the company workspace's search", () => {
  for (const role of ["viewer", "admin", "auditor", undefined]) {
    it(`sends ${role ?? "a guest"} to /public, keeping the filters`, async () => {
      assert.equal(await redirectOf("/search?q=cloud&similar=abc", role), "/public?q=cloud&similar=abc");
    });
  }

  for (const role of ["org", "owner"]) {
    it(`lets ${role} in`, async () => {
      assert.equal(await redirectOf("/search?q=cloud", role), null);
    });
  }
});

describe("a TOR opened with ?in=app", () => {
  for (const role of ["viewer", "admin", "auditor", undefined]) {
    it(`opens in the public layout for ${role ?? "a guest"}`, async () => {
      assert.equal(await redirectOf(`${TOR}?in=app`, role), TOR);
    });
  }

  for (const role of ["org", "owner"]) {
    it(`stays in the workspace for ${role}`, async () => {
      assert.equal(await redirectOf(`${TOR}?in=app`, role), null);
    });
  }

  it("leaves the public TOR page alone for a viewer", async () => {
    assert.equal(await redirectOf(TOR, "viewer"), null);
  });
});

// Each role's own pages, and where everyone else is sent (their own home).
const HOME = { viewer: "/dashboard", org: "/dashboard", owner: "/owner", admin: "/admin", auditor: "/auditor" };
const OWN_PAGES = {
  org: ["/matches", "/profile", "/library", "/growth", "/notifications"],
  owner: ["/owner"],
  admin: ["/admin", "/admin/users", "/admin/audit"],
  auditor: ["/auditor"],
};

describe("each role's pages are its own", () => {
  for (const [owner, pages] of Object.entries(OWN_PAGES)) {
    for (const page of pages) {
      it(`${page} opens for ${owner}`, async () => {
        assert.equal(await redirectOf(page, owner), null);
      });

      for (const role of Object.keys(HOME).filter((r) => r !== owner)) {
        it(`${page} sends ${role} away`, async () => {
          // admin pages send other signed-in roles to the public overview, as before.
          const expected = owner === "admin" ? "/dashboard" : HOME[role];
          assert.equal(await redirectOf(page, role), expected);
        });
      }

      it(`${page} sends a guest to sign in`, async () => {
        assert.equal(await redirectOf(page), `/login?next=${encodeURIComponent(page)}`);
      });
    }
  }
});

describe("the normal user's pages are open to every role", () => {
  for (const page of ["/", "/public", "/dashboard", "/insights", TOR, "/saved"]) {
    for (const role of Object.keys(HOME)) {
      it(`${page} for ${role}`, async () => {
        const target = await redirectOf(page, role);
        // "/" is the guest landing page; a signed-in account goes to its own home from there.
        assert.equal(target, page === "/" ? HOME[role] : null);
      });
    }
  }
});

describe("/saved?scope=org is the company's shared list", () => {
  it("sends a viewer to their own saved list", async () => {
    assert.equal(await redirectOf("/saved?scope=org", "viewer"), "/saved");
  });

  it("lets an org account in", async () => {
    assert.equal(await redirectOf("/saved?scope=org", "org"), null);
  });

  it("still lets a viewer open their own saved list", async () => {
    assert.equal(await redirectOf("/saved", "viewer"), null);
  });
});
