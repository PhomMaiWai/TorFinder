#!/usr/bin/env node
// ReDoS audit for TorFinder (ASVS 1.3.12). Finds every regular expression in
// backend/src and frontend/src with the TypeScript parser (regex literals and
// `new RegExp("…")` with a literal pattern), then checks each one two ways:
//
//  1. Shape: a quantified group that itself contains a quantifier, such as
//     (a+)+ or (\w*)*, or an alternation repeated over overlapping branches —
//     the forms that backtrack exponentially.
//  2. Behaviour: each pattern runs against long inputs built to make a
//     backtracking engine try every split; anything slower than
//     MAX_MS_PER_INPUT is reported.
//
// backend/test/regex-audit.test.mjs runs this in CI and fails on a finding.
//
//   node scripts/regex-audit.mjs   # list every pattern and the result

import { createRequire } from "node:module";
import vm from "node:vm";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(ROOT, "backend/package.json"))("typescript");

const SOURCE_DIRS = ["backend/src", "frontend/src"];
/** Far above what any linear pattern needs for these inputs; an exponential one blows straight past it. */
const MAX_MS_PER_INPUT = 50;

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith(".d.ts")) yield full;
  }
}

/** Every regex in the source: { file, line, source, flags }. */
export function findRegexes(root = ROOT) {
  const found = [];
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(path.join(root, dir))) {
      const text = readFileSync(file, "utf8");
      const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const where = (node) => ({ file: path.relative(root, file).split(path.sep).join("/"), line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
      const visit = (node) => {
        if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
          const literal = node.getText();
          const end = literal.lastIndexOf("/");
          found.push({ ...where(node), source: literal.slice(1, end), flags: literal.slice(end + 1) });
        } else if (
          ts.isNewExpression(node) &&
          node.expression.getText() === "RegExp" &&
          node.arguments?.[0] &&
          (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
        ) {
          const flagsArg = node.arguments[1];
          found.push({ ...where(node), source: node.arguments[0].text, flags: flagsArg && ts.isStringLiteral(flagsArg) ? flagsArg.text : "" });
        }
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
  }
  return found;
}

/** A quantified group containing a quantifier, or a repeated alternation of identical branches. */
export function hasNestedQuantifier(source) {
  const flat = source.replace(/\\./g, "x").replace(/\[[^\]]*\]/g, "C");
  const group = /\((?:\?[:=!<]+)?((?:[^()]|\([^()]*\))*)\)([+*]|\{\d+,\d*\})/g;
  for (const match of flat.matchAll(group)) {
    if (/[+*]|\{\d+,\d*\}/.test(match[1])) return true;
    const branches = match[1].split("|");
    if (branches.length > 1 && new Set(branches).size < branches.length) return true;
  }
  return false;
}

/** Inputs that make a backtracking engine work hardest: long runs of the pattern's own characters, then a mismatch. */
function adversarialInputs(source) {
  const chars = new Set(["a", "0", " ", "-", ".", "_", "x", "@", "/"]);
  for (const ch of source.replace(/\\[dwsDWS]/g, "").match(/[A-Za-z0-9 _.\-@/]/g) ?? []) chars.add(ch);
  const runs = [...chars].map((ch) => ch.repeat(5000));
  return runs.flatMap((run) => [run + "!", "!" + run, run + "\n" + run + "\u0000"]);
}

/** Hard stop for one match, so a pattern that backtracks forever is reported instead of hanging the audit. */
const HARD_STOP_MS = 1000;

/**
 * Runs each pattern against the adversarial inputs; returns the slowest
 * input's time in ms, or Infinity when a match had to be stopped. The match
 * runs in a vm context with a timeout, which interrupts the regex engine.
 */
export function slowestMatchMs({ source, flags }) {
  let re;
  try {
    re = new RegExp(source, flags.replace(/[gy]/g, ""));
  } catch {
    return 0; // not compilable on its own (e.g. a TS-only literal); the shape check still covers it
  }
  let worst = 0;
  for (const input of adversarialInputs(source)) {
    const started = performance.now();
    try {
      vm.runInNewContext("re.test(input)", { re, input }, { timeout: HARD_STOP_MS });
    } catch {
      return Infinity;
    }
    worst = Math.max(worst, performance.now() - started);
  }
  return worst;
}

export function audit(root = ROOT) {
  const regexes = findRegexes(root);
  const findings = [];
  for (const regex of regexes) {
    if (hasNestedQuantifier(regex.source)) {
      findings.push({ ...regex, problem: "nested quantifier" });
      continue; // already a finding; no need to make it backtrack
    }
    const ms = slowestMatchMs(regex);
    if (ms > MAX_MS_PER_INPUT) findings.push({ ...regex, problem: `slow: ${ms.toFixed(0)} ms on an adversarial input` });
  }
  return { count: regexes.length, findings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { count, findings } = audit();
  console.log(`${count} regular expressions checked`);
  for (const f of findings) console.log(`${f.file}:${f.line} /${f.source}/${f.flags} — ${f.problem}`);
  if (!findings.length) console.log("no ReDoS-prone pattern found");
  process.exitCode = findings.length ? 1 : 0;
}
