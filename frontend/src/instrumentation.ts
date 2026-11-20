/**
 * Runs once when the server starts, before it serves anything. On Node.js it
 * sets up the client certificate the frontend presents to the backend (ASVS
 * 12.3.5; see lib/internal-tls.ts). Nothing runs on the edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { enableInternalTls } = await import("./lib/internal-tls");
    enableInternalTls();
  }
}
