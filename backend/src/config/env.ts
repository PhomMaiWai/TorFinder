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
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/torr"),
  sessionSecret: required("SESSION_SECRET", "dev-only-insecure-secret-change-me"),
  // Google Identity Services ID tokens are verified against this audience.
  // Empty in dev disables Google sign-in rather than throwing on every request.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  // Demo data is for local and staging; production starts from a clean database.
  seedDemoData: (process.env.SEED_DEMO_DATA ?? String(!isProduction)) === "true",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
  throttle: {
    // General API abuse guard (generous — the login route below is stricter).
    ttlMs: optionalNumber("THROTTLE_TTL_MS", 60_000),
    limit: optionalNumber("THROTTLE_LIMIT", 100),
    // Login is brute-forceable, so it gets its own tighter budget.
    authTtlMs: optionalNumber("AUTH_THROTTLE_TTL_MS", 60_000),
    authLimit: optionalNumber("AUTH_THROTTLE_LIMIT", 5),
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
  },
  /**
   * Only the knobs an operator would turn without a redeploy. Everything else
   * about the import — the portal's URLs, the search keywords, per-request
   * timeouts — is code, and lives in egp/egp.constants.ts.
   */
  egp: {
    // Import depth per announcement type. e-GP holds thousands of projects, so a
    // sync takes the newest pages rather than the whole archive.
    maxPages: optionalNumber("EGP_MAX_PAGES", 2),
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
};
