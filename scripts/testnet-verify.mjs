// Re-checks the testnet records against the chain, with no keys, so anyone with a
// clone can run it: each contract in deployments/testnet.json against the repo's
// source and Clarity version, and each step in deployments/testnet-run.json for its
// sender, block and result (#7). After a testnet reset these fail until
// `npm run testnet` rebuilds the records.
import fs from "node:fs";
import { API, clarityVersionOf } from "./testnet-accounts.mjs";

const deployments = JSON.parse(fs.readFileSync("deployments/testnet.json", "utf8"));
const run = JSON.parse(fs.readFileSync("deployments/testnet-run.json", "utf8"));
const get = (path) => fetch(`${API}${path}`).then((r) => (r.ok ? r.json() : null));
let checks = 0, failed = 0;
const report = (ok, line) => { checks++; if (!ok) failed++; console.log(`  ${ok ? "ok  " : "FAIL"} ${line}`); };

console.log(`contracts deployed by ${deployments.deployer}:`);
for (const [name, { id, txid, block }] of Object.entries(deployments.contracts)) {
  const c = await get(`/extended/v1/contract/${id}`);
  if (!c) { report(false, `${name}: not on testnet`); continue; }
  const same = c.source_code === fs.readFileSync(`contracts/${name}.clar`, "utf8");
  report(same && c.clarity_version === clarityVersionOf(name) && c.tx_id === txid && c.block_height === block,
    `${name.padEnd(17)} block ${c.block_height}, Clarity ${c.clarity_version}, source ${same ? "identical to" : "DIFFERS from"} the repo`);
}

console.log(`end-to-end run, owner ${run.owner}, delegate ${run.delegate}:`);
for (const s of run.steps) {
  const t = await get(`/extended/v1/tx/${s.txid}`);
  const result = t?.tx_result?.repr;
  report(t?.tx_status === "success" && t.sender_address === s.from && t.block_height === s.block && result === s.result,
    `${s.label.padEnd(32)} ${t ? `${t.tx_status}, block ${t.block_height}, ${result}` : "not found"}`);
}

console.log(failed ? `${failed} of ${checks} checks failed` : `all ${checks} checks pass`);
process.exitCode = failed ? 1 : 0;
