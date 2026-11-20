// Unit coverage for ASVS 12.3.5: the backend's HTTPS options and caller check
// (src/common/internal-tls.ts), over a real TLS handshake. A throwaway CA and
// certificates are made with openssl in a temp folder, like
// docker/certs/generate.sh does. Loaded from dist — run `npm run build` first.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpsRequest, createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "torr-internal-tls-"));
const file = (name) => join(dir, name);
const openssl = (...args) => execFileSync("openssl", args, { stdio: "pipe" });

function leaf(name, cn, eku, san) {
  openssl("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", file(`${name}.key`));
  openssl("req", "-new", "-key", file(`${name}.key`), "-subj", `/O=TorFinder/CN=${cn}`, "-out", file(`${name}.csr`));
  const ext = `extendedKeyUsage=${eku}${san ? `\nsubjectAltName=${san}` : ""}`;
  execFileSync("sh", ["-c", `printf '%s' "$EXT" > ${file(`${name}.ext`)}`], { env: { ...process.env, EXT: ext } });
  openssl("x509", "-req", "-in", file(`${name}.csr`), "-CA", file("ca.crt"), "-CAkey", file("ca.key"), "-CAcreateserial",
    "-days", "1", "-extfile", file(`${name}.ext`), "-out", file(`${name}.crt`));
}

openssl("ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", file("ca.key"));
openssl("req", "-x509", "-new", "-key", file("ca.key"), "-subj", "/CN=test CA", "-days", "1", "-out", file("ca.crt"));
leaf("server", "backend", "serverAuth", "DNS:localhost");
leaf("frontend", "frontend", "clientAuth");
leaf("db", "db", "serverAuth,clientAuth", "DNS:localhost");

process.env.INTERNAL_TLS_CERT_FILE = file("server.crt");
process.env.INTERNAL_TLS_KEY_FILE = file("server.key");
process.env.INTERNAL_TLS_CA_FILE = file("ca.crt");

let server;
let port;
before(async () => {
  const { internalHttpsOptions, requireInternalClient } = await import("../dist/common/internal-tls.js");
  const options = internalHttpsOptions();
  assert.equal(options.requestCert, true);
  assert.equal(options.rejectUnauthorized, true);
  server = createServer(options, (request, response) => {
    // The same middleware the backend installs first, with a minimal Express-like response.
    const res = Object.assign(response, {
      status(code) {
        response.statusCode = code;
        return res;
      },
      json(body) {
        response.end(JSON.stringify(body));
      },
    });
    requireInternalClient(request, res, () => response.end("ok"));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
});

after(() => {
  server?.close();
  rmSync(dir, { recursive: true, force: true });
});

const read = (path) => readFileSync(path);

function call(clientCert, tls = {}) {
  return new Promise((resolve) => {
    const req = httpsRequest(
      {
        host: "127.0.0.1",
        port,
        servername: "localhost",
        path: "/api/x",
        ca: read(file("ca.crt")),
        ...(clientCert && { cert: read(file(`${clientCert}.crt`)), key: read(file(`${clientCert}.key`)) }),
        ...tls,
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode, body }));
      },
    );
    req.on("error", (error) => resolve({ error: error.code ?? error.message }));
    req.end();
  });
}

describe("backend mutual TLS (ASVS 12.3.5)", () => {
  it("refuses a connection with no client certificate during the handshake", async () => {
    const result = await call(null);
    assert.ok(result.error, `expected a TLS failure, got ${JSON.stringify(result)}`);
  });

  it("refuses another internal service's certificate with 403", async () => {
    assert.equal((await call("db")).status, 403);
  });

  it("refuses TLS 1.2, even with the frontend's certificate (ASVS 11.6.2, 12.1.2)", async () => {
    const result = await call("frontend", { maxVersion: "TLSv1.2" });
    assert.ok(result.error, `expected a TLS failure, got ${JSON.stringify(result)}`);
  });

  it("serves the frontend's certificate", async () => {
    const result = await call("frontend");
    assert.equal(result.status, 200);
    assert.equal(result.body, "ok");
  });
});
