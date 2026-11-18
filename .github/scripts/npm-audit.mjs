// `npm audit --omit=dev --audit-level=high`, except for advisories in
// .github/audit-exceptions.json (ASVS 15.2.1). An exception names one advisory
// for one project, says why it is safe, and expires: after `until` it fails the
// build again, so nothing stays excepted by being forgotten.
//
// Usage, from frontend/ or backend/: node ../.github/scripts/npm-audit.mjs <project>

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const project = process.argv[2];
if (!project) {
  console.error("usage: npm-audit.mjs <project>");
  process.exit(2);
}

const FAILING = new Set(["high", "critical"]);
const today = new Date().toISOString().slice(0, 10);

const exceptions = JSON.parse(readFileSync(new URL("../audit-exceptions.json", import.meta.url), "utf8")).filter(
  (entry) => entry.project === project,
);

let raw;
try {
  raw = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  raw = error.stdout;
  if (!raw) throw error;
}
const report = JSON.parse(raw);
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(1);
}

// Each advisory appears as an object in the `via` list of the package it is
// about; packages that only depend on it list it by name and add nothing new.
const advisories = new Map();
for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via !== "object" || !FAILING.has(via.severity)) continue;
    const id = String(via.url ?? "").split("/").pop();
    advisories.set(`${id} ${name}`, { id, name, title: via.title, severity: via.severity });
  }
}

const failures = [];
for (const advisory of advisories.values()) {
  const exception = exceptions.find((entry) => entry.advisory === advisory.id && entry.package === advisory.name);
  if (!exception) {
    failures.push(`${advisory.severity}: ${advisory.name} ${advisory.id} (${advisory.title})`);
  } else if (exception.until < today) {
    failures.push(`${advisory.severity}: ${advisory.name} ${advisory.id}: its exception expired on ${exception.until}; re-check it`);
  } else {
    console.log(`excepted until ${exception.until}: ${advisory.name} ${advisory.id}: ${exception.reason}`);
  }
}

if (failures.length > 0) {
  console.error(`${failures.length} high or critical advisory(ies) in production dependencies:\n  ${failures.join("\n  ")}`);
  console.error("Fix them (npm audit fix), or add a reasoned, dated entry to .github/audit-exceptions.json.");
  process.exit(1);
}
console.log(`No unexcepted high or critical advisories in ${project}'s production dependencies.`);
