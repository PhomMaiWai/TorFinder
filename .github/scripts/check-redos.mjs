// ASVS 1.3.12: no regular expression in TorFinder can be driven into
// exponential (or polynomial) backtracking. Finds every regex literal and
// every `new RegExp("…")` with a literal pattern in backend/src and
// frontend/src, and checks each with recheck (https://makenowjust-labs.github.io/recheck/),
// which proves a pattern safe or builds an attack string for it.
//
// Fails on any pattern recheck finds vulnerable, or can't decide, unless it
// is listed in ALLOWED below with the reason it is safe in practice. A
// `new RegExp` built from a variable can't be checked here; those are
// reported so each one can be reviewed (they escape their input first).
//
//   cd backend && node ../.github/scripts/check-redos.mjs
//
// Uses typescript and recheck from backend/node_modules.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

const ROOT = new URL("../..", import.meta.url).pathname;
const require = createRequire(join(ROOT, "backend/package.json"));
const ts = require("typescript");
const { checkSync } = require("recheck");

const SOURCES = ["backend/src", "frontend/src"];

/**
 * Patterns recheck can't prove safe, with why they are. Keyed by the
 * pattern's source text. Keep this empty if at all possible.
 */
const ALLOWED = new Map([]);

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) yield path;
  }
}

/** Every regex in a file: { pattern, flags, line } for literals and literal `new RegExp`; { dynamic, line } otherwise. */
function regexesIn(path) {
  const text = readFileSync(path, "utf8");
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = [];
  const lineOf = (node) => file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
      const literal = node.getText();
      const end = literal.lastIndexOf("/");
      found.push({ pattern: literal.slice(1, end), flags: literal.slice(end + 1), line: lineOf(node) });
    } else if (ts.isNewExpression(node) && node.expression.getText() === "RegExp" && node.arguments?.length) {
      const [source, flags] = node.arguments;
      if (ts.isStringLiteralLike(source) && (!flags || ts.isStringLiteralLike(flags))) {
        found.push({ pattern: source.text, flags: flags?.text ?? "", line: lineOf(node) });
      } else {
        found.push({ dynamic: node.getText(), line: lineOf(node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const failures = [];
const dynamic = [];
let checked = 0;

for (const source of SOURCES) {
  for (const path of sourceFiles(join(ROOT, source))) {
    for (const regex of regexesIn(path)) {
      const where = `${relative(ROOT, path)}:${regex.line}`;
      if (regex.dynamic) {
        dynamic.push(`${where}  ${regex.dynamic}`);
        continue;
      }
      checked += 1;
      const result = checkSync(regex.pattern, regex.flags, { timeout: 10_000 });
      if (result.status === "safe") continue;
      if (ALLOWED.has(regex.pattern)) continue;
      const detail =
        result.status === "vulnerable"
          ? `${result.complexity.type} backtracking, e.g. ${JSON.stringify(result.attack.pattern ?? result.attack.string).slice(0, 80)}`
          : `couldn't decide (${result.error?.kind ?? "unknown"})`;
      failures.push(`${where}  /${regex.pattern}/${regex.flags}  →  ${detail}`);
    }
  }
}

if (dynamic.length > 0) {
  console.log(`RegExp built at run time (not checkable here; each must escape its input or be fixed text):`);
  for (const line of dynamic) console.log(`  ${line}`);
  console.log("");
}

if (failures.length > 0) {
  console.error(`ReDoS check failed for ${failures.length} of ${checked} patterns:\n`);
  for (const line of failures) console.error(`  ${line}`);
  console.error("\nRewrite the pattern without nested or overlapping repetition, or, if it is safe in practice, add it to ALLOWED with the reason.");
  process.exit(1);
}
console.log(`ReDoS check: all ${checked} regular expressions are safe.`);
