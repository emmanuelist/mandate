// Deploys Mandate's M1 contracts to Stacks testnet from account 1, in dependency
// order, confirming each before the next. Contracts already deployed are skipped,
// so after a testnet reset the same command rebuilds everything (#7).
// Writes deployments/testnet.json.
import fs from "node:fs";
import { makeContractDeploy, ClarityVersion, fetchNonce } from "@stacks/transactions";
import { testnetAccounts, broadcast, waitFor, API } from "./testnet-accounts.mjs";

// Clarity versions match Clarinet.toml, so testnet runs what the tests run.
const CONTRACTS = [
  ["sip-010-trait", ClarityVersion.Clarity4],
  ["venue-trait", ClarityVersion.Clarity4],
  ["mock-token", ClarityVersion.Clarity3],
  ["mock-venue", ClarityVersion.Clarity4],
  ["mandate-vault-v3", ClarityVersion.Clarity4],
];

const [owner] = await testnetAccounts();
const record = { network: "testnet", deployer: owner.address, contracts: {} };
console.log(`deployer ${owner.address}`);
for (const [name, clarityVersion] of CONTRACTS) {
  const id = `${owner.address}.${name}`;
  const existing = await fetch(`${API}/extended/v1/contract/${id}`).then((r) => (r.ok ? r.json() : null));
  if (existing?.tx_id) {
    console.log(`  ${name.padEnd(17)} already deployed   ${existing.tx_id}`);
    record.contracts[name] = { id, txid: existing.tx_id, block: existing.block_height };
    continue;
  }
  const nonce = await fetchNonce({ address: owner.address, network: "testnet" });
  const tx = await makeContractDeploy({
    contractName: name, codeBody: fs.readFileSync(`contracts/${name}.clar`, "utf8"),
    clarityVersion, senderKey: owner.key, network: "testnet", nonce, fee: 500_000n,
  });
  const txid = await broadcast(tx, name);
  process.stdout.write(`  ${name.padEnd(17)} ${txid} ... `);
  const { block } = await waitFor(txid, name);
  console.log(`block ${block}`);
  record.contracts[name] = { id, txid, block };
}
fs.writeFileSync("deployments/testnet.json", JSON.stringify(record, null, 2) + "\n");
console.log("wrote deployments/testnet.json");
