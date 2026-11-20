import { readFileSync } from "node:fs";
import type { TLSSocket } from "node:tls";

import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env";
import { logSecurityEvent } from "./security-log";

/**
 * ASVS 12.3.5: services inside TorFinder authenticate each other with TLS
 * certificates from a private CA (made by docker/certs/generate.sh):
 *
 * - the backend serves HTTPS and accepts a connection only from a client
 *   certificate signed by that CA (the TLS handshake fails otherwise), and
 *   then only one whose common name is an allowed caller: the frontend;
 * - the frontend presents its certificate and trusts only a backend
 *   certificate from the same CA (frontend/src/lib/internal-tls.ts);
 * - the backend logs in to MongoDB with its own certificate (MONGODB-X509),
 *   not a password, over TLS (docker-compose.yml).
 *
 * Off unless INTERNAL_TLS_CERT_FILE, _KEY_FILE and _CA_FILE are set:
 * docker-compose sets them; the test suite and `npm run dev` run plain HTTP.
 */

export type InternalHttpsOptions = {
  cert: Buffer;
  key: Buffer;
  ca: Buffer;
  requestCert: true;
  rejectUnauthorized: true;
  minVersion: "TLSv1.2";
};

export function internalHttpsOptions(): InternalHttpsOptions | undefined {
  const { certFile, keyFile, caFile } = env.internalTls;
  if (!certFile && !keyFile && !caFile) return undefined;
  if (!certFile || !keyFile || !caFile) {
    throw new Error("INTERNAL_TLS_CERT_FILE, INTERNAL_TLS_KEY_FILE and INTERNAL_TLS_CA_FILE are set together or not at all");
  }
  return {
    cert: readFileSync(certFile),
    key: readFileSync(keyFile),
    ca: readFileSync(caFile),
    requestCert: true,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  };
}

/**
 * The handshake has already checked the certificate is from the private CA;
 * this checks it is one of the callers allowed to use the API, so another
 * internal certificate (the database's, or the backend's own) can't.
 */
export function requireInternalClient(request: Request, response: Response, next: NextFunction): void {
  const socket = request.socket as TLSSocket;
  const name = socket.authorized ? socket.getPeerCertificate()?.subject?.CN : undefined;
  if (typeof name === "string" && env.internalTls.allowedClients.includes(name)) {
    next();
    return;
  }
  logSecurityEvent("access.denied", {
    outcome: "failure",
    ip: request.ip,
    reason: `internal_client_${name ?? "none"}`,
    method: request.method,
    path: request.path,
  });
  response.status(403).json({ statusCode: 403, message: "Forbidden" });
}
