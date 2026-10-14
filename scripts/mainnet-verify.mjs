// Re-checks the mainnet records against the chain, with no keys, so anyone with a clone
// can run it (#34): each contract in deployments/mainnet.json against the repo's source
// and Clarity version, and each asset's cap read back from the vault. Until
// `node scripts/mainnet-deploy.mjs --broadcast` has run, there is nothing to check.
import fs from "node:fs";
import { fetchCallReadOnlyFunction, Cl } from "@stacks/transactions";

const API = "https://api.hiro.so";
if (!fs.existsSync("deployments/mainnet.json")) {
  console.log("no deployments/mainnet.json: the vault isn't on mainnet yet");
  process.exit(1);
}
const rec = JSON.parse(fs.readFileSync("deployments/mainnet.json", "utf8"));
// the contracts that go to mainnet, with their Clarity versions, are the review manifest's
const clarityVersionOf = (name) => Number(fs.readFileSync("Clarinet-review.toml", "utf8").split(/^\[/m)
  .find((s) => s.startsWith(`contracts.${name}]`))?.match(/^clarity_version\s*=\s*(\d+)/m)?.[1]);
const get = (path) => fetch(`${API}${path}`).then((r) => (r.ok ? r.json() : null));
let checks = 0, failed = 0;
const report = (ok, line) => { checks++; if (!ok) failed++; console.log(`  ${ok ? "ok  " : "FAIL"} ${line}`); };

console.log(`contracts deployed by ${rec.deployer}:`);
for (const [name, { id, txid, block }] of Object.entries(rec.contracts)) {
  const c = await get(`/extended/v1/contract/${id}`);
  if (!c) { report(false, `${name}: not on mainnet`); continue; }
  const same = c.source_code === fs.readFileSync(`contracts/${name}.clar`, "utf8");
  report(same && c.clarity_version === clarityVersionOf(name) && c.tx_id === txid && c.block_height === block,
    `${name.padEnd(17)} block ${c.block_height}, Clarity ${c.clarity_version}, source ${same ? "identical to" : "DIFFERS from"} the repo`);
}

const vault = rec.contracts["mandate-vault-v5"]?.id;
console.log(`caps in ${vault}:`);
for (const [asset, { cap }] of Object.entries(rec.caps)) {
  const [contractAddress, contractName] = vault.split(".");
  const read = Cl.prettyPrint(await fetchCallReadOnlyFunction({ contractAddress, contractName, functionName: "cap-of",
    functionArgs: [Cl.principal(asset)], senderAddress: rec.deployer, network: "mainnet" }));
  report(read === `u${cap}`, `${asset}: ${read}, recorded u${cap}`);
}

console.log(failed ? `${failed} of ${checks} checks failed` : `all ${checks} checks pass`);
process.exitCode = failed ? 1 : 0;
