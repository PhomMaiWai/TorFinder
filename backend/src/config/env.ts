// Local runs read backend/.env; in Docker the values come from the service's
// `environment:` instead and there is no file to load.
try {
  process.loadEnvFile();
} catch {
  // No .env — real environment variables (or the dev defaults below) apply.
}

const isProduction = process.env.NODE_ENV === "production";

// Fails fast in production if a real secret/connection string was never set,
// instead of silently booting with an insecure or wrong-environment default.
function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProduction) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return devFallback;
}

/** The placeholder every .env.example ships with — public, so never a real key. */
const DEV_SESSION_SECRET = "dev-only-insecure-secret-change-me";
/** 32 characters ≈ the 256-bit HMAC key `openssl rand -base64 32` produces. */
const MIN_SESSION_SECRET_LENGTH = 32;

/**
 * The key every session token is signed with. Anyone who knows it can mint an
 * admin token, so production refuses the published placeholder and anything
 * short enough to guess — `required()` alone can't catch a placeholder that a
 * compose file or copied .env passed in (ASVS 9.1.3).
 */
function sessionSecret(): string {
  const value = required("SESSION_SECRET", DEV_SESSION_SECRET);
  if (isProduction && (value === DEV_SESSION_SECRET || value.length < MIN_SESSION_SECRET_LENGTH)) {
    throw new Error(
      `SESSION_SECRET must be a private random value of at least ${MIN_SESSION_SECRET_LENGTH} characters in production — generate one with: openssl rand -base64 32`,
    );
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got "${value}"`);
  }
  return parsed;
}

export const env = {
  isProduction,
  port: optionalNumber("PORT", 4000),
  // Announcements published before this are kept but not listed: they are
  // too old to be anyone's opportunity or a useful price reference.
  torListedSince: new Date(process.env.TOR_LISTED_SINCE ?? "2022-01-01"),
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/torfinder"),
  sessionSecret: sessionSecret(),
  // Google Identity Services ID tokens are verified against this audience.
  // Empty in dev disables Google sign-in rather than throwing on every request.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  // Demo data is for local and staging; production starts from a clean database.
  seedDemoData: (process.env.SEED_DEMO_DATA ?? String(!isProduction)) === "true",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  /**
   * Which hops may name the client in X-Forwarded-For (Express `trust proxy`).
   * The default trusts loopback and private addresses — the frontend on the
   * same machine or Docker network — and never a public address.
   */
  trustProxy: process.env.TRUST_PROXY ?? "loopback, uniquelocal",
  throttle: {
    // General API abuse guard (generous — the login route below is stricter).
    ttlMs: optionalNumber("THROTTLE_TTL_MS", 60_000),
    limit: optionalNumber("THROTTLE_LIMIT", 100),
    // Login is brute-forceable, so it gets its own tighter budget.
    authTtlMs: optionalNumber("AUTH_THROTTLE_TTL_MS", 60_000),
    authLimit: optionalNumber("AUTH_THROTTLE_LIMIT", 5),
    // Failed logins per email address, whatever IP they come from — what still
    // stops guessing one account's password when the attacker rotates or
    // spoofs addresses (ASVS 6.3.1).
    loginFailureLimit: optionalNumber("LOGIN_FAILURE_LIMIT", 10),
    loginFailureWindowMs: optionalNumber("LOGIN_FAILURE_WINDOW_MS", 15 * 60_000),
  },
  /**
   * Where notifications go besides the in-app list. Each channel switches
   * itself off while its credential is empty, so nothing here is required.
   */
  notify: {
    // Email through Resend's HTTP API — no SMTP client to install.
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    emailFrom: process.env.NOTIFY_EMAIL_FROM ?? "TOR Finder <noreply@torfinder.app>",
    // LINE Messaging API: the official account's long-lived channel access token.
    lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
    // A new announcement scoring at least this for a company is worth telling it about.
    matchThreshold: optionalNumber("NOTIFY_MATCH_THRESHOLD", 70),
    // Per company per import, so a large first sync doesn't flood anyone.
    maxMatchesPerRun: optionalNumber("NOTIFY_MAX_MATCHES_PER_RUN", 5),
  },
  /**
   * Vertex AI. Credentials are never configured here — the SDK reads
   * Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS, or the
   * host's service account). An empty project id leaves extraction switched
   * off, so the app runs fine without GCP.
   */
  ai: {
    projectId: process.env.VERTEX_PROJECT_ID ?? "",
    location: process.env.VERTEX_LOCATION ?? "asia-southeast1",
    model: process.env.VERTEX_MODEL ?? "gemini-2.5-flash",
    // Turns a TOR or a pasted project into numbers for "find similar". Has to
    // read Thai, and takes many texts per request, so a whole backfill is a
    // few dozen calls rather than one per announcement.
    embeddingModel: process.env.VERTEX_EMBEDDING_MODEL ?? "text-multilingual-embedding-002",
    // Background reading of the documents the imports bring in. Off on startup
    // by default: every run costs money, and a machine that restarts often
    // would pay for it each time. Ignored entirely without a project id.
    pollMinutes: optionalNumber("AI_POLL_MINUTES", 60),
    pollOnStartup: process.env.AI_POLL_ON_STARTUP === "true",
  },
  /**
   * Only the knobs an operator would turn without a redeploy. Everything else
   * about the import — the portal's URLs, the search keywords, per-request
   * timeouts — is code, and lives in egp/egp.constants.ts.
   */
  egp: {
    // How far back each sync reads, newest first. Open tenders are weeks old;
    // a few months also keeps the awards a bidder looks back on.
    lookbackDays: optionalNumber("EGP_LOOKBACK_DAYS", 120),
    // A safety stop per announcement type whatever the dates say — the window
    // normally ends the scan long before this.
    maxPages: optionalNumber("EGP_MAX_PAGES", 40),
    // Requests in flight against the portal — lower it if it starts rate-limiting.
    concurrency: optionalNumber("EGP_CONCURRENCY", 5),
    // Background refresh. 0 turns polling off and leaves the admin button as the
    // only way to import.
    pollMinutes: optionalNumber("EGP_POLL_MINUTES", 360),
    pollOnStartup: (process.env.EGP_POLL_ON_STARTUP ?? "true") === "true",
    // Wall-clock cap on the enrichment phase: if the portal is slow the sync
    // still finishes on time with whatever it managed, and anything skipped is
    // retried on the next run (see EgpService.enrichedSourceRefs).
    enrichBudgetMs: optionalNumber("EGP_ENRICH_BUDGET_MS", 45_000),
  },
  /**
   * The agency's own procurement site. It publishes only its own announcements
   * but adds the documents and the buying department e-GP leaves out, so it is
   * polled on the same rhythm.
   */
  mea: {
    pollMinutes: optionalNumber("MEA_POLL_MINUTES", 360),
    pollOnStartup: (process.env.MEA_POLL_ON_STARTUP ?? "true") === "true",
  },
  /**
   * The open-data portal republishes กรมบัญชีกลาง's procurement reports once a
   * month, so polling it every few hours would only re-read what it already
   * handed over. Daily is already ahead of the data.
   */
  datagov: {
    pollMinutes: optionalNumber("DATAGOV_POLL_MINUTES", 1_440),
    pollOnStartup: (process.env.DATAGOV_POLL_ON_STARTUP ?? "true") === "true",
  },
  /**
   * The national e-GP is read for the procurement step of the announcements
   * still open, and to follow captured projects to their next announcement —
   * a few dozen projects, one at a time. Every three hours keeps "still open"
   * true to within a morning without leaning on a shared national service.
   */
  gproc: {
    pollMinutes: optionalNumber("GPROC_POLL_MINUTES", 180),
    pollOnStartup: (process.env.GPROC_POLL_ON_STARTUP ?? "true") === "true",
  },
};
