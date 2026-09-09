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

/**
 * Departments to pull announcements for, as "deptId:ชื่อหน่วยงาน" pairs joined by
 * "|". An RSS item carries no agency name, so it can only come from knowing which
 * deptId was queried. Empty means the nationwide feed.
 */
function egpDepartments(): { deptId: string; agency: string }[] {
  const raw = process.env.EGP_DEPARTMENTS?.trim();
  if (!raw) return [];

  return raw.split("|").map((entry) => {
    const [id, ...name] = entry.split(":");
    const deptId = id?.trim() ?? "";
    const agency = name.join(":").trim();
    if (!deptId || !agency) {
      throw new Error(`EGP_DEPARTMENTS entry must be "deptId:ชื่อหน่วยงาน", got "${entry}"`);
    }
    return { deptId, agency };
  });
}

export const env = {
  isProduction,
  port: optionalNumber("PORT", 4000),
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/torr"),
  sessionSecret: required("SESSION_SECRET", "dev-only-insecure-secret-change-me"),
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
  egp: {
    feedUrl:
      process.env.EGP_FEED_URL ??
      "https://process.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml",
    departments: egpDepartments(),
    timeoutMs: optionalNumber("EGP_TIMEOUT_MS", 20_000),
  },
};
