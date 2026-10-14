// The M1 end-to-end run on testnet, with testnet's official sBTC: the owner funds
// a mandate, the delegate allocates into the testnet sBTC venue and unwinds, and
// the owner withdraws. One transaction per step, each confirmed and checked for
// (ok ...) before the next. Then the books must reconcile: the owner's vault
// balance and position, and the sBTC held by the owner, the vault and the venue,
// all end where they started. Run it through `npm run testnet`, which first checks
// the deployed contracts against the repo. Writes deployments/testnet-run.json.
import fs from "node:fs";
import {
  makeContractCall, makeSTXTokenTransfer, fetchNonce, fetchCallReadOnlyFunction,
  Cl, PostConditionMode,
} from "@stacks/transactions";
import { testnetAccounts, broadcast, waitFor, sbtcBalance, API, SBTC } from "./testnet-accounts.mjs";

// Small, so that reproducing the run takes little testnet sBTC. The sBTC comes back
// to the owner at the end, so a rerun needs no more.
const DEPOSIT = 20_000n;
const MOVE = 10_000n;

const [owner, delegate] = await testnetAccounts();
const D = owner.address;
const sbtc = Cl.contractPrincipal(SBTC.address, SBTC.name);
const venue = Cl.contractPrincipal(D, "mock-venue-sbtc");
const info = await fetch(`${API}/v2/info`).then((r) => r.json());
const expires = info.burn_block_height + 1008; // about a week of Bitcoin blocks
const run = { network: "testnet", asset: `${SBTC.address}.${SBTC.name}`, owner: D, delegate: delegate.address,
  vault: `${D}.mandate-vault-v4`, venue: `${D}.mock-venue-sbtc`, steps: [] };

async function step(label, from, txFn) {
  const nonce = await fetchNonce({ address: from.address, network: "testnet" });
  const txid = await broadcast(await txFn(nonce), label);
  process.stdout.write(`  ${label.padEnd(30)} ${txid} ... `);
  const { block, result } = await waitFor(txid, label);
  if (!String(result).startsWith("(ok")) throw new Error(`${label}: ${result}`);
  console.log(`${result}, block ${block}`);
  run.steps.push({ label, from: from.address, txid, block, result });
}
const call = (fn, args, from) => (nonce) => makeContractCall({
  contractAddress: D, contractName: "mandate-vault-v4", functionName: fn, functionArgs: args,
  senderKey: from.key, network: "testnet", nonce, fee: 100_000n,
  // The vault bounds its own outflows with as-contract? allowances, which is what
  // this run shows; wallet post-conditions are a separate client-side protection.
  postConditionMode: PostConditionMode.Allow,
});
const read = async (contractId, fn, args) => {
  const [contractAddress, contractName] = contractId.split(".");
  return Cl.prettyPrint(await fetchCallReadOnlyFunction({
    contractAddress, contractName, functionName: fn, functionArgs: args, senderAddress: D, network: "testnet",
  }));
};
const sbtcOf = (who) => read(run.asset, "get-balance", [Cl.principal(who)]);
const books = async () => ({
  ownerIdleInVault: await read(run.vault, "balance-of", [Cl.principal(D), sbtc]),
  ownerPosition: await read(run.vault, "shares-of", [Cl.principal(D), venue]),
  ownerSbtc: await sbtcOf(D),
  vaultSbtc: await sbtcOf(run.vault),
  venueSbtc: await sbtcOf(run.venue),
});
const amount = (printed) => BigInt(printed.match(/u(\d+)/)[1]);
const fmt = (n) => n.toLocaleString("en-US");

console.log(`owner ${D}\ndelegate ${delegate.address}`);
const held = await sbtcBalance(D);
if (held < DEPOSIT) {
  throw new Error(`account 1 holds ${held} sats of testnet sBTC and the run needs ${DEPOSIT}: request testnet sBTC from the Hiro Platform faucet (see the README)`);
}
const before = await books();
const delegateStx = BigInt((await fetch(`${API}/extended/v1/address/${delegate.address}/stx`).then((r) => r.json())).balance);
if (delegateStx < 1_000_000n) {
  await step("fund the delegate's fees: 5 STX", owner, (nonce) => makeSTXTokenTransfer({
    recipient: delegate.address, amount: 5_000_000n, senderKey: owner.key, network: "testnet", nonce, fee: 10_000n,
  }));
}
await step("owner allowlists testnet sBTC", owner, call("allow-asset", [sbtc], owner));
await step("owner allowlists the venue", owner, call("allow-venue", [venue, sbtc], owner));
await step(`owner deposits ${fmt(DEPOSIT)} sats`, owner, call("deposit", [sbtc, Cl.uint(DEPOSIT)], owner));
await step("owner grants the delegate", owner, call("grant", [
  Cl.principal(delegate.address), Cl.uint(500_000), Cl.uint(expires), Cl.uint(100),
  Cl.uint(10), Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000)], owner));
await step(`delegate allocates ${fmt(MOVE)}`, delegate, call("allocate", [Cl.principal(D), venue, sbtc, Cl.uint(MOVE)], delegate));
await step(`delegate unwinds ${fmt(MOVE)}`, delegate, call("unwind", [Cl.principal(D), venue, sbtc, Cl.uint(MOVE)], delegate));
await step(`owner withdraws ${fmt(DEPOSIT)} sats`, owner, call("withdraw", [sbtc, Cl.uint(DEPOSIT)], owner));

const after = await books();
run.checks = { before, after };
for (const [key, printed] of Object.entries(after)) {
  if (amount(printed) !== amount(before[key])) throw new Error(`books don't reconcile: ${key} is ${printed}, was ${before[key]}`);
}
console.log("books reconcile, before:", JSON.stringify(before), "\n                  after: ", JSON.stringify(after));
fs.writeFileSync("deployments/testnet-run.json", JSON.stringify(run, null, 2) + "\n");
console.log("wrote deployments/testnet-run.json");
