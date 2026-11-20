// ASVS 11.1.3: cryptographic discovery. Finds every use of a cryptographic
// primitive or library in backend/src and frontend/src, and compares it with
// the inventory in docs/security/cryptography.md. Fails when the code uses
// cryptography the inventory doesn't list (a new file, or a new primitive in
// a listed file), or the inventory lists something the code no longer does.
// So the inventory can't silently go out of date.
//
//   node .github/scripts/check-crypto-inventory.mjs
//
// No dependencies; run from the repository root (CI does).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const SOURCES = ["backend/src", "frontend/src"];
const INVENTORY = "docs/security/cryptography.md";

/** What counts as cryptography, and the token the inventory writes for it. */
const DETECTORS = [
  [/createHmac\(\s*"(\w+)"/g, (m) => `HMAC-${m[1].toUpperCase()}`],
  [/createHash\(\s*"(\w+)"/g, (m) => m[1].toUpperCase().replace(/^SHA(\d)/, "SHA-$1")],
  // Named imports catch a primitive used indirectly, e.g. promisify(scrypt).
  [/import\s*\{[^}]*\bscrypt(?:Sync)?\b[^}]*\}\s*from\s*"(?:node:)?crypto"/g, () => "scrypt"],
  [/import\s*\{[^}]*\bpbkdf2(?:Sync)?\b[^}]*\}\s*from\s*"(?:node:)?crypto"/g, () => "pbkdf2"],
  [/\brandomBytes\(/g, () => "randomBytes"],
  [/\brandomInt\(/g, () => "randomInt"],
  [/\brandomUUID\(/g, () => "randomUUID"],
  [/\bgetRandomValues\(/g, () => "getRandomValues"],
  [/\btimingSafeEqual\(/g, () => "timingSafeEqual"],
  [/crypto\.subtle\.(\w+)\(/g, (m) => `subtle.${m[1]}`],
  [/\b(createCipheriv|createDecipheriv|createSign|createVerify|generateKeyPair\w*|publicEncrypt|privateDecrypt|pbkdf2\w*|hkdf\w*)\(/g, (m) => m[1]],
  [/from\s+"(jose|@simplewebauthn\/(?:server|browser)|google-auth-library|bcrypt\w*|argon2)"/g, (m) => m[1]],
];

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx|mts|js|mjs)$/.test(name) && !/\.test\./.test(name)) yield path;
  }
}

/** file → sorted primitives, as found in the code. */
function discover() {
  const found = new Map();
  for (const source of SOURCES) {
    for (const path of sourceFiles(join(ROOT, source))) {
      const text = readFileSync(path, "utf8");
      const tokens = new Set();
      for (const [pattern, token] of DETECTORS) {
        for (const match of text.matchAll(pattern)) tokens.add(token(match));
      }
      if (tokens.size > 0) found.set(relative(ROOT, path), [...tokens].sort());
    }
  }
  return found;
}

/** file → sorted primitives, as the inventory's table lists them: | `file` | `tok`, `tok` | … */
function inventory() {
  const listed = new Map();
  for (const line of readFileSync(join(ROOT, INVENTORY), "utf8").split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const file = /^`((?:backend|frontend)\/src\/[^`]+)`$/.exec(cells[1] ?? "")?.[1];
    if (!file) continue;
    listed.set(file, [...(cells[2] ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort());
  }
  return listed;
}

const found = discover();
const listed = inventory();
const problems = [];

for (const [file, tokens] of found) {
  const documented = listed.get(file);
  if (!documented) {
    problems.push(`not in the inventory: ${file} uses ${tokens.join(", ")}`);
  } else if (documented.join() !== tokens.join()) {
    problems.push(`${file}: code uses ${tokens.join(", ")}; inventory lists ${documented.join(", ")}`);
  }
}
for (const file of listed.keys()) {
  if (!found.has(file)) problems.push(`listed but uses no cryptography any more: ${file}`);
}

if (problems.length > 0) {
  console.error(`Cryptography inventory (${INVENTORY}) is out of date:\n`);
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\nAdd or correct the file's row: | `path` | `primitive`, … | purpose | key |");
  process.exit(1);
}
console.log(`Cryptography inventory matches the code: ${found.size} files.`);
