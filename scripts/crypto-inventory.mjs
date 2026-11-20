#!/usr/bin/env node
// Cryptographic discovery for TorFinder (ASVS 11.1.3): finds every place the
// backend and frontend source call a cryptographic API — hashing, MACs,
// signatures, key derivation, random numbers, token verification — so the
// inventory in docs/security/crypto-inventory.md can be checked against the
// code instead of trusted. backend/test/crypto-inventory.test.mjs fails when
// the code uses cryptography somewhere the inventory doesn't list.
//
//   node scripts/crypto-inventory.mjs          # print what it finds, per file
//   node scripts/crypto-inventory.mjs --json   # the same as JSON

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = ["backend/src", "frontend/src"];

/**
 * The APIs that are cryptography, by family. Node's `crypto` module, the Web
 * Crypto API, and the libraries that verify signatures for us (Google ID
 * tokens, WebAuthn). A name here is matched as a whole word in the source.
 */
export const CRYPTO_APIS = {
  hash: ["createHash"],
  mac: ["createHmac", "crypto.subtle.sign", "crypto.subtle.importKey"],
  "key derivation": ["scrypt", "pbkdf2", "hkdf"],
  comparison: ["timingSafeEqual"],
  random: ["randomBytes", "randomUUID", "randomInt", "crypto.getRandomValues", "crypto.randomUUID"],
  encryption: ["createCipheriv", "createDecipheriv", "crypto.subtle.encrypt", "crypto.subtle.decrypt"],
  signature: ["createSign", "createVerify", "generateKeyPair", "crypto.subtle.verify"],
  "signed tokens": ["verifyIdToken", "jwt.sign", "jwt.verify"],
  webauthn: [
    "generateRegistrationOptions",
    "verifyRegistrationResponse",
    "generateAuthenticationOptions",
    "verifyAuthenticationResponse",
  ],
};

const API_FAMILY = Object.fromEntries(Object.entries(CRYPTO_APIS).flatMap(([family, apis]) => apis.map((api) => [api, family])));
const PATTERN = new RegExp(
  `(?<![\\w.])(${Object.keys(API_FAMILY)
    .sort((a, b) => b.length - a.length)
    .map((api) => api.replace(/\./g, "\\."))
    .join("|")})\\b`,
  "g",
);

/** Source with block and line comments blanked, so a comment that names an API isn't counted as a use. */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name) && !/\.(spec|test)\./.test(name)) yield full;
  }
}

/** { "backend/src/common/token.ts": ["createHmac", "timingSafeEqual"], … }, sorted. */
export function discover(root = ROOT) {
  const found = {};
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(path.join(root, dir))) {
      const apis = new Set();
      for (const match of withoutComments(readFileSync(file, "utf8")).matchAll(PATTERN)) apis.add(match[1]);
      if (apis.size) found[path.relative(root, file).split(path.sep).join("/")] = [...apis].sort();
    }
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const found = discover();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(found, null, 2));
  } else {
    for (const [file, apis] of Object.entries(found)) {
      console.log(`${file}: ${apis.map((api) => `${api} (${API_FAMILY[api]})`).join(", ")}`);
    }
  }
}
