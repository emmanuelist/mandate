// Re-checks the testnet records against the chain, with no keys, so anyone with a
// clone can run it: each contract in deployments/testnet.json against the repo's
// source and Clarity version, and each step in deployments/testnet-run.json for its
// sender, block and result (#7), and each of the reference delegate's transactions
// in deployments/testnet-delegate-run.json for its signer, result and deny-mode
// post-conditions (#33), the owner's side of that mandate, and each refusal in
// deployments/testnet-refusals.json for its call, its refusal code and that nothing
// moved (#52). After a testnet reset these fail until `npm run testnet` and the
// delegate's run rebuild the records.
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

if (fs.existsSync("deployments/testnet-delegate-run.json")) {
  const dr = JSON.parse(fs.readFileSync("deployments/testnet-delegate-run.json", "utf8"));
  console.log(`reference delegate ${dr.delegate}, signing alone for owner ${dr.owner}:`);
  for (const r of dr.rounds.filter((x) => x.txid)) {
    const t = await get(`/extended/v1/tx/${r.txid}`);
    const result = t?.tx_result?.repr;
    report(t?.tx_status === "success" && t.sender_address === dr.delegate && t.post_condition_mode === "deny" && result === r.result,
      `${(t?.contract_call?.function_name ?? "?").padEnd(9)} ${t ? `${t.tx_status}, block ${t.block_height}, ${result}, signer ${t.sender_address === dr.delegate ? "the delegate" : t.sender_address}, post-conditions ${t.post_condition_mode}` : "not found"}`);
  }
}

if (fs.existsSync("deployments/testnet-delegate.json")) {
  const cfg = JSON.parse(fs.readFileSync("deployments/testnet-delegate.json", "utf8"));
  console.log(`the owner's side of that mandate, owner ${cfg.owner}, vault ${cfg.vault}:`);
  for (const s of cfg.ownerSteps ?? []) {
    const t = await get(`/extended/v1/tx/${s.txid}`);
    const result = t?.tx_result?.repr;
    report(t?.tx_status === "success" && t.sender_address === cfg.owner && t.block_height === s.block && result === s.result,
      `${s.label.padEnd(32)} ${t ? `${t.tx_status}, block ${t.block_height}, ${result}` : "not found"}`);
  }
}

if (fs.existsSync("deployments/testnet-refusals.json")) {
  const rf = JSON.parse(fs.readFileSync("deployments/testnet-refusals.json", "utf8"));
  console.log(`refusals: the delegate ${rf.delegate} attempting what its mandate forbids, in ${rf.vault}:`);
  for (const a of rf.attempts) {
    const t = await get(`/extended/v1/tx/${a.txid}`);
    const result = t?.tx_result?.repr;
    report(t?.tx_status === "abort_by_response" && result === `(err u${a.expect})` && t.sender_address === rf.delegate &&
      t.post_condition_mode === "deny" && t.event_count === 0 && t.contract_call?.function_name === a.call,
      `${a.kind.padEnd(15)} ${t ? `${t.contract_call?.function_name} ${t.tx_status}, ${result}, ${t.event_count} events, signer ${t.sender_address === rf.delegate ? "the delegate" : t.sender_address}, block ${t.block_height}` : "not found"}`);
  }
}

console.log(failed ? `${failed} of ${checks} checks failed` : `all ${checks} checks pass`);
process.exitCode = failed ? 1 : 0;
