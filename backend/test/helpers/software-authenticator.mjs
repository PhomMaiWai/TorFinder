// A software passkey for tests: what a phone or security key does, in Node.
// It makes a real P-256 key pair, answers registration with a "none"
// attestation and sign-in with an ES256 signature, so the backend's
// @simplewebauthn/server checks run for real — origin, RP id hash, challenge,
// signature and counter — rather than being mocked.

import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const sha256 = (data) => createHash("sha256").update(data).digest();

// ---- the few CBOR shapes WebAuthn needs (RFC 8949) ----
function head(major, length) {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 0x100) return Buffer.from([(major << 5) | 24, length]);
  if (length < 0x10000) {
    const out = Buffer.alloc(3);
    out[0] = (major << 5) | 25;
    out.writeUInt16BE(length, 1);
    return out;
  }
  const out = Buffer.alloc(5);
  out[0] = (major << 5) | 26;
  out.writeUInt32BE(length, 1);
  return out;
}

function cbor(value) {
  if (Number.isInteger(value)) return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (typeof value === "string") {
    const bytes = Buffer.from(value, "utf8");
    return Buffer.concat([head(3, bytes.length), bytes]);
  }
  if (value instanceof Map) {
    const parts = [head(5, value.size)];
    for (const [key, item] of value) parts.push(cbor(key), cbor(item));
    return Buffer.concat(parts);
  }
  throw new Error(`cbor: unsupported ${typeof value}`);
}

const FLAG_UP = 0x01; // user present: the "touch"
const FLAG_AT = 0x40; // attested credential data follows

export class SoftwareAuthenticator {
  /** @param {string} origin the site's origin, as a browser would report it */
  constructor(origin) {
    this.origin = origin;
    this.credentialId = randomBytes(32);
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.privateKey = privateKey;
    this.publicJwk = publicKey.export({ format: "jwk" });
    this.counter = 0;
  }

  get id() {
    return b64url(this.credentialId);
  }

  coseKey() {
    return cbor(
      new Map([
        [1, 2], // kty: EC2
        [3, -7], // alg: ES256
        [-1, 1], // crv: P-256
        [-2, Buffer.from(this.publicJwk.x, "base64url")],
        [-3, Buffer.from(this.publicJwk.y, "base64url")],
      ]),
    );
  }

  clientData(type, challenge, origin = this.origin) {
    return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
  }

  counterBytes() {
    const out = Buffer.alloc(4);
    out.writeUInt32BE(this.counter);
    return out;
  }

  /** Answers navigator.credentials.create() for the options the backend handed out. */
  register(options, { origin } = {}) {
    const credLength = Buffer.alloc(2);
    credLength.writeUInt16BE(this.credentialId.length);
    const authData = Buffer.concat([
      sha256(options.rp.id),
      Buffer.from([FLAG_UP | FLAG_AT]),
      this.counterBytes(),
      Buffer.alloc(16), // AAGUID: none
      credLength,
      this.credentialId,
      this.coseKey(),
    ]);
    const attestationObject = cbor(
      new Map([
        ["fmt", "none"],
        ["attStmt", new Map()],
        ["authData", authData],
      ]),
    );
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64url(this.clientData("webauthn.create", options.challenge, origin)),
        attestationObject: b64url(attestationObject),
        transports: ["internal"],
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }

  /** Answers navigator.credentials.get(): signs authenticatorData ‖ SHA-256(clientDataJSON). */
  authenticate(options, { origin, counter } = {}) {
    // An explicit counter is a one-off (to fake a cloned key); the device's own keeps counting.
    if (counter === undefined) this.counter += 1;
    const used = Buffer.alloc(4);
    used.writeUInt32BE(counter ?? this.counter);
    const authData = Buffer.concat([sha256(options.rpId), Buffer.from([FLAG_UP]), used]);
    const clientDataJSON = this.clientData("webauthn.get", options.challenge, origin);
    const signature = sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), this.privateKey);
    return {
      id: this.id,
      rawId: this.id,
      type: "public-key",
      response: {
        clientDataJSON: b64url(clientDataJSON),
        authenticatorData: b64url(authData),
        signature: b64url(signature),
      },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    };
  }
}
