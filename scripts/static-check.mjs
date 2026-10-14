// Static checks (#37). Every manifest's contracts must check with no errors, and every
// warning Clarinet raises, from its lints and, on Clarinet-review.toml, its taint
// analysis, must be justified in docs/REVIEW.md's static-analysis table. A warning the
// table doesn't list fails, and so does a row whose warning has gone, so the log can't
// fall behind the code. CI runs it with Clarinet 3.24.1.
//   node scripts/static-check.mjs          check
//   node scripts/static-check.mjs --rows   print the current warnings as table rows
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Clarinet-jing.toml is left out: Jing's market contract, its requirement, names a Pyth
// contract that `clarinet check` can't resolve. The Jing suite runs it on a fork.
const MANIFESTS = ["Clarinet.toml", "Clarinet-local.toml", "Clarinet-testnet.toml", "Clarinet-review.toml"];
const TAINT = "use of potentially unchecked data";

const found = new Map(); // "file|check" -> line numbers, one per warning
const seen = new Set();
const errors = [];
for (const m of MANIFESTS) {
  let out;
  try {
    out = execFileSync("clarinet", ["check", "-c", "-m", m, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    if (e.code === "ENOENT") { console.error("clarinet is not on PATH: install Clarinet 3.24.1"); process.exit(2); }
    out = e.stdout; // clarinet exits non-zero when a contract fails to check
  }
  const d = JSON.parse(out);
  for (const [file, diags] of Object.entries(d.diagnostics)) {
    for (const x of diags) {
      const at = x.spans?.[0] ?? {};
      if (x.level === "Error") { errors.push(`${m}: ${file}:${at.start_line ?? "?"} ${x.message}`); continue; }
      if (x.level !== "Warning" || file.startsWith("./.cache/")) continue; // notes, and other people's code
      const check = x.lint_name ?? (x.message === TAINT ? "check_checker" : `warning: ${x.message}`);
      const key = `${file}|${check}|${at.start_line}|${at.start_column}`;
      if (seen.has(key)) continue; // the same contract in several manifests
      seen.add(key);
      const k = `${file}|${check}`;
      found.set(k, [...(found.get(k) ?? []), at.start_line].sort((a, b) => a - b));
    }
  }
  if (!d.success && !errors.some((e) => e.startsWith(`${m}:`))) errors.push(`${m}: the check failed`);
}

if (process.argv.includes("--rows")) {
  for (const [k, lines] of [...found].sort()) {
    const [file, check] = k.split("|");
    console.log(`| \`${file}\` | \`${check}\` | ${lines.join(", ")} | |`);
  }
  process.exit(0);
}

const listed = new Map();
for (const r of readFileSync("docs/REVIEW.md", "utf8").matchAll(/^\| `(contracts\/[^`]+)` \| `([^`]+)` \| ([\d, ]+) \|/gm)) {
  listed.set(`${r[1]}|${r[2]}`, r[3].split(",").map((n) => Number(n.trim())).sort((a, b) => a - b));
}
const problems = [...errors];
for (const k of new Set([...found.keys(), ...listed.keys()])) {
  const [file, check] = k.split("|");
  const f = (found.get(k) ?? []).join(", "), l = (listed.get(k) ?? []).join(", ");
  if (f !== l) problems.push(`${file} ${check}: Clarinet warns at lines [${f}], docs/REVIEW.md lists [${l}]`);
}
if (problems.length) {
  console.error(`static checks: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
const warnings = [...found.values()].reduce((n, l) => n + l.length, 0);
console.log(`static checks: ${MANIFESTS.length} manifests check with no errors, and all ${warnings} warnings are justified in docs/REVIEW.md.`);
