// Deploys the contracts Clarinet-testnet.toml lists to Stacks testnet from account
// 1, in the manifest's order, confirming each before the next. A contract already
// deployed with the repo's source is skipped, so after a testnet reset the same
// command rebuilds everything (#7, #26). Writes deployments/testnet.json.
import fs from "node:fs";
import { makeContractDeploy, fetchNonce } from "@stacks/transactions";
import { testnetAccounts, broadcast, waitFor, API, clarityVersionOf, testnetContracts } from "./testnet-accounts.mjs";

const [owner] = await testnetAccounts();
const record = { network: "testnet", deployer: owner.address, contracts: {} };
console.log(`deployer ${owner.address}`);
for (const name of testnetContracts()) {
  const id = `${owner.address}.${name}`;
  const source = fs.readFileSync(`contracts/${name}.clar`, "utf8");
  const clarityVersion = clarityVersionOf(name);
  const existing = await fetch(`${API}/extended/v1/contract/${id}`).then((r) => (r.ok ? r.json() : null));
  if (existing?.tx_id) {
    // Deployed code can't change, and a run against an older deployment would prove
    // the wrong code, so stop rather than skip it.
    if (existing.source_code !== source || existing.clarity_version !== clarityVersion) {
      throw new Error(`${id} was deployed from a different contracts/${name}.clar: deploy from a fresh testnet account`);
    }
    console.log(`  ${name.padEnd(17)} already deployed, identical to the repo   ${existing.tx_id}`);
    record.contracts[name] = { id, txid: existing.tx_id, block: existing.block_height };
    continue;
  }
  const nonce = await fetchNonce({ address: owner.address, network: "testnet" });
  const tx = await makeContractDeploy({
    contractName: name, codeBody: source,
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
