import { readFileSync } from "node:fs";

import { Agent, Pool, setGlobalDispatcher } from "undici";

/**
 * ASVS 12.3.5: the frontend and the backend authenticate each other with TLS
 * certificates from a private CA, not only by the user's session token. The
 * backend accepts a connection only with the frontend's certificate; the
 * frontend accepts only a backend presenting a certificate from the same CA.
 *
 * Every server-side `fetch` in the frontend goes through Node's global
 * dispatcher, so one dispatcher set at startup covers them all: connections
 * to BACKEND_URL carry the client certificate and trust only the private CA,
 * and any other origin keeps the default trust store.
 *
 * Off unless INTERNAL_TLS_CERT_FILE is set (docker-compose sets it; a
 * frontend run from the shell against a plain-HTTP backend doesn't).
 */
export function enableInternalTls(): void {
  const certFile = process.env.INTERNAL_TLS_CERT_FILE;
  const keyFile = process.env.INTERNAL_TLS_KEY_FILE;
  const caFile = process.env.INTERNAL_TLS_CA_FILE;
  if (!certFile && !keyFile && !caFile) return;
  if (!certFile || !keyFile || !caFile) {
    throw new Error("INTERNAL_TLS_CERT_FILE, INTERNAL_TLS_KEY_FILE and INTERNAL_TLS_CA_FILE are set together or not at all");
  }

  const backend = new URL(process.env.BACKEND_URL ?? "");
  if (backend.protocol !== "https:") {
    throw new Error(`BACKEND_URL must be https:// when internal TLS is on, got ${backend.origin}`);
  }

  const connect = {
    cert: readFileSync(certFile),
    key: readFileSync(keyFile),
    ca: readFileSync(caFile),
    servername: backend.hostname,
    rejectUnauthorized: true,
  };

  setGlobalDispatcher(
    new Agent({
      factory: (origin, options) =>
        new Pool(origin, new URL(String(origin)).origin === backend.origin ? { ...options, connect } : options),
    }),
  );
}
