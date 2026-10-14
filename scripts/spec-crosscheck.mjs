// Fails if a test in the vault's suites isn't named in docs/SPEC.md, so the threat
// model can't fall behind the tests (#8). CI runs it on every pull request.
import { readFileSync } from "node:fs";

const files = ["tests/v4.test.ts", "tests/v4-hostile.test.ts", "tests/v4-zest-fork.test.ts", "tests/v4-granite-fork.test.ts", "tests/sbtc-testnet.fork.ts", "tests/phishing.test.ts"];
const spec = readFileSync("docs/SPEC.md", "utf8");
const missing = [];
let count = 0;
for (const f of files) {
  for (const m of readFileSync(f, "utf8").matchAll(/\bit\(\s*"([^"]+)"/g)) {
    count++;
    if (!spec.includes(`"${m[1]}"`)) missing.push(`${f}: ${m[1]}`);
  }
}
if (missing.length) {
  console.error(`docs/SPEC.md is missing ${missing.length} of ${count} tests:`);
  for (const x of missing) console.error(`  ${x}`);
  process.exit(1);
}
console.log(`docs/SPEC.md names all ${count} tests in the vault's suites.`);
