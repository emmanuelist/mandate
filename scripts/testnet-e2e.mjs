// The M1 end-to-end run on testnet: the owner funds a mandate, the delegate
// allocates into the mock venue and unwinds, and the owner withdraws. One
// transaction per step, each confirmed and checked for (ok ...) before the next,
// then read-only checks that the books reconcile. Writes deployments/testnet-run.json.
import fs from "node:fs";
import {
  makeContractCall, makeSTXTokenTransfer, fetchNonce, fetchCallReadOnlyFunction,
  Cl, PostConditionMode,
} from "@stacks/transactions";
import { testnetAccounts, broadcast, waitFor, API } from "./testnet-accounts.mjs";

const [owner, delegate] = await testnetAccounts();
const D = owner.address;
const mock = Cl.contractPrincipal(D, "mock-token");
const venue = Cl.contractPrincipal(D, "mock-venue");
const info = await fetch(`${API}/v2/info`).then((r) => r.json());
const expires = info.burn_block_height + 1008; // about a week of Bitcoin blocks
const run = { network: "testnet", owner: D, delegate: delegate.address, vault: `${D}.mandate-vault-v3`, steps: [] };

async function step(label, from, txFn) {
  const nonce = await fetchNonce({ address: from.address, network: "testnet" });
  const txid = await broadcast(await txFn(nonce), label);
  process.stdout.write(`  ${label.padEnd(30)} ${txid} ... `);
  const { block, result } = await waitFor(txid, label);
  if (!String(result).startsWith("(ok")) throw new Error(`${label}: ${result}`);
  console.log(`${result}, block ${block}`);
  run.steps.push({ label, from: from.address, txid, block, result });
}
const call = (contract, fn, args, from) => (nonce) => makeContractCall({
  contractAddress: D, contractName: contract, functionName: fn, functionArgs: args,
  senderKey: from.key, network: "testnet", nonce, fee: 100_000n,
  // The vault bounds its own outflows with as-contract? allowances, which is what
  // this run shows; wallet post-conditions are a separate client-side protection.
  postConditionMode: PostConditionMode.Allow,
});
const read = async (contract, fn, args) => Cl.prettyPrint(await fetchCallReadOnlyFunction({
  contractAddress: D, contractName: contract, functionName: fn, functionArgs: args,
  senderAddress: D, network: "testnet",
}));

console.log(`owner ${D}\ndelegate ${delegate.address}`);
await step("fund the delegate's fees: 5 STX", owner, (nonce) => makeSTXTokenTransfer({
  recipient: delegate.address, amount: 5_000_000n, senderKey: owner.key, network: "testnet", nonce, fee: 10_000n,
}));
await step("owner mints 1,000,000 mock", owner, call("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(D)], owner));
await step("owner allowlists the asset", owner, call("mandate-vault-v3", "allow-asset", [mock], owner));
await step("owner allowlists the venue", owner, call("mandate-vault-v3", "allow-venue", [venue, mock], owner));
await step("owner deposits 400,000", owner, call("mandate-vault-v3", "deposit", [mock, Cl.uint(400_000)], owner));
await step("owner grants the delegate", owner, call("mandate-vault-v3", "grant", [
  Cl.principal(delegate.address), Cl.uint(500_000), Cl.uint(expires), Cl.uint(100),
  Cl.uint(10), Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000)], owner));
await step("delegate allocates 100,000", delegate, call("mandate-vault-v3", "allocate",
  [Cl.principal(D), venue, mock, Cl.uint(100_000)], delegate));
await step("delegate unwinds 100,000", delegate, call("mandate-vault-v3", "unwind",
  [Cl.principal(D), venue, mock, Cl.uint(100_000)], delegate));
await step("owner withdraws 400,000", owner, call("mandate-vault-v3", "withdraw", [mock, Cl.uint(400_000)], owner));

run.checks = {
  ownerIdleInVault: await read("mandate-vault-v3", "balance-of", [Cl.principal(D), mock]),
  ownerPosition: await read("mandate-vault-v3", "shares-of", [Cl.principal(D), venue]),
  ownerWallet: await read("mock-token", "get-balance", [Cl.principal(D)]),
  vaultTokens: await read("mock-token", "get-balance", [Cl.principal(`${D}.mandate-vault-v3`)]),
};
console.log("checks:", JSON.stringify(run.checks));
fs.writeFileSync("deployments/testnet-run.json", JSON.stringify(run, null, 2) + "\n");
console.log("wrote deployments/testnet-run.json");
