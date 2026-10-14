// The owner's side of the reference delegate's testnet run (#33): fund a mandate in
// the vault with testnet sBTC and grant it to the delegate whose address
// deployments/testnet-delegate.json holds, and give that delegate STX for fees.
// The owner, account 1 of settings/Testnet.toml, never sees the delegate's key.
// Adds the mandate's details to deployments/testnet-delegate.json.
import fs from "node:fs";
import { makeContractCall, makeSTXTokenTransfer, fetchNonce, Cl, PostConditionMode } from "@stacks/transactions";
import { testnetAccounts, broadcast, waitFor, sbtcBalance, API, SBTC } from "./testnet-accounts.mjs";

const DEPOSIT = 40_000n;
const record = "deployments/testnet-delegate.json";
const cfg = JSON.parse(fs.readFileSync(record, "utf8"));
if (!cfg.delegate) throw new Error(`no delegate address in ${record}: run npm run delegate:key -- testnet`);
const [owner] = await testnetAccounts();
const D = owner.address;
const vault = `${D}.mandate-vault-v5`, venue = `${D}.mock-venue-sbtc`, asset = `${SBTC.address}.${SBTC.name}`;
if ((await sbtcBalance(D)) < DEPOSIT) throw new Error(`account 1 needs ${DEPOSIT} sats of testnet sBTC: see the README`);

async function step(label, txFn) {
  const nonce = await fetchNonce({ address: D, network: "testnet" });
  const txid = await broadcast(await txFn(nonce), label);
  process.stdout.write(`  ${label.padEnd(34)} ${txid} ... `);
  const { block, result } = await waitFor(txid, label);
  if (!String(result).startsWith("(ok")) throw new Error(`${label}: ${result}`);
  console.log(`${result}, block ${block}`);
  return { label, txid, block, result };
}
const call = (fn, args) => (nonce) => makeContractCall({
  contractAddress: D, contractName: "mandate-vault-v5", functionName: fn, functionArgs: args,
  senderKey: owner.key, network: "testnet", nonce, fee: 100_000n, postConditionMode: PostConditionMode.Allow,
});

const info = await fetch(`${API}/v2/info`).then((r) => r.json());
const limits = { maxNotional: 20_000, expires: info.burn_block_height + 1008, maxSlipBps: 100,
  maxTrades: 10, windowLen: 144, maxDaily: 200_000, maxCumSlipBps: 10_000 };
console.log(`owner ${D}\ndelegate ${cfg.delegate}`);
const steps = [];
const stx = BigInt((await fetch(`${API}/extended/v1/address/${cfg.delegate}/stx`).then((r) => r.json())).balance);
if (stx < 1_000_000n) {
  steps.push(await step("fund the delegate's fees: 2 STX", (nonce) => makeSTXTokenTransfer({
    recipient: cfg.delegate, amount: 2_000_000n, senderKey: owner.key, network: "testnet", nonce, fee: 10_000n })));
}
steps.push(await step("owner allowlists testnet sBTC", call("allow-asset", [Cl.principal(asset)])));
steps.push(await step("owner allowlists the venue", call("allow-venue", [Cl.principal(venue), Cl.principal(asset)])));
steps.push(await step(`owner deposits ${DEPOSIT.toLocaleString("en-US")} sats`, call("deposit", [Cl.contractPrincipal(SBTC.address, SBTC.name), Cl.uint(DEPOSIT)])));
steps.push(await step("owner grants the delegate", call("grant", [
  Cl.principal(cfg.delegate), Cl.uint(limits.maxNotional), Cl.uint(limits.expires), Cl.uint(limits.maxSlipBps),
  Cl.uint(limits.maxTrades), Cl.uint(limits.windowLen), Cl.uint(limits.maxDaily), Cl.uint(limits.maxCumSlipBps)])));
fs.writeFileSync(record, JSON.stringify({ ...cfg, owner: D, vault, venue, asset, limits, ownerSteps: steps }, null, 2) + "\n");
console.log(`wrote ${record}`);
