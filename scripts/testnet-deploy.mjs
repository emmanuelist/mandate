// Deploys the contracts Clarinet-testnet.toml lists to Stacks testnet from account
// 1, in the manifest's order, confirming each before the next. A contract already
// deployed with the repo's source is skipped, so after a testnet reset the same
// command rebuilds everything (#7, #26). Writes deployments/testnet.json.
import fs from "node:fs";
import { makeContractDeploy, makeContractCall, fetchNonce, fetchCallReadOnlyFunction, Cl, PostConditionMode } from "@stacks/transactions";
import { testnetAccounts, broadcast, waitFor, API, SBTC, clarityVersionOf, testnetContracts } from "./testnet-accounts.mjs";

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
// The vault refuses deposits of an asset without a cap, so the deployer sets testnet
// sBTC's once, at mainnet's 1,000,000 sats (D-018). Nothing can change it after.
if (record.contracts["mandate-vault-v5"]) {
  const asset = `${SBTC.address}.${SBTC.name}`;
  const cap = Cl.prettyPrint(await fetchCallReadOnlyFunction({ contractAddress: owner.address, contractName: "mandate-vault-v5",
    functionName: "cap-of", functionArgs: [Cl.principal(asset)], senderAddress: owner.address, network: "testnet" }));
  if (cap === "u0") {
    const nonce = await fetchNonce({ address: owner.address, network: "testnet" });
    const tx = await makeContractCall({ contractAddress: owner.address, contractName: "mandate-vault-v5", functionName: "set-cap",
      functionArgs: [Cl.principal(asset), Cl.uint(1_000_000)], senderKey: owner.key, network: "testnet", nonce, fee: 100_000n,
      postConditionMode: PostConditionMode.Deny });
    const txid = await broadcast(tx, "set-cap");
    process.stdout.write(`  set testnet sBTC's cap   ${txid} ... `);
    const { block, result } = await waitFor(txid, "set-cap");
    console.log(`${result}, block ${block}`);
    record.caps = { [asset]: { cap: 1_000_000, txid, block } };
  } else {
    console.log(`  testnet sBTC's cap        already set: ${cap}`);
    record.caps = { [asset]: { cap: Number(cap.slice(1)) } };
  }
}
fs.writeFileSync("deployments/testnet.json", JSON.stringify(record, null, 2) + "\n");
console.log("wrote deployments/testnet.json");
