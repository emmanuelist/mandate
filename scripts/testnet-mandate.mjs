// The owner's side of the reference delegate's testnet run (#33): fund a mandate in
// the vault with testnet sBTC and grant it to the delegate whose address
// deployments/testnet-delegate.json holds, and give that delegate STX for fees.
// The owner, account 1 of settings/Testnet.toml, never sees the delegate's key.
// Adds the mandate's details to deployments/testnet-delegate.json.
//   node scripts/testnet-mandate.mjs          fund the mandate and grant it
//   node scripts/testnet-mandate.mjs revoke   revoke it
//   node scripts/testnet-mandate.mjs exit     unwind every share and withdraw every sat
import fs from "node:fs";
import { makeContractCall, makeSTXTokenTransfer, fetchNonce, fetchCallReadOnlyFunction, Cl, PostConditionMode } from "@stacks/transactions";
import { testnetAccounts, broadcast, waitFor, sbtcBalance, API, SBTC } from "./testnet-accounts.mjs";

const DEPOSIT = 40_000n;
const record = "deployments/testnet-delegate.json";
const cfg = JSON.parse(fs.readFileSync(record, "utf8"));
if (!cfg.delegate) throw new Error(`no delegate address in ${record}: run npm run delegate:key -- testnet`);
const [owner] = await testnetAccounts();
const D = owner.address;
const vault = `${D}.mandate-vault-v5`, venue = `${D}.mock-venue-sbtc`, asset = `${SBTC.address}.${SBTC.name}`;
const action = process.argv[2] ?? "grant";
if (!["grant", "revoke", "exit"].includes(action)) throw new Error(`unknown action ${action}: revoke or exit, or none to grant`);

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

const sbtc = Cl.contractPrincipal(SBTC.address, SBTC.name);
const read = async (fn, args) => Cl.prettyPrint(await fetchCallReadOnlyFunction({
  contractAddress: D, contractName: "mandate-vault-v5", functionName: fn, functionArgs: args, senderAddress: D, network: "testnet" }));
const amount = (printed) => BigInt(printed.match(/u(\d+)/)[1]);

if (action !== "grant") {
  if (cfg.vault !== vault) throw new Error(`${record} records a mandate in ${cfg.vault}, not ${vault}: grant one first`);
  const steps = cfg.ownerSteps ?? [];
  if (action === "revoke") {
    steps.push(await step("owner revokes the delegate", call("revoke", [Cl.principal(cfg.delegate)])));
  } else {
    // the owner's own exit needs no mandate; the minimum is the venue's 1:1 less 1%
    const shares = amount(await read("shares-of", [Cl.principal(D), Cl.principal(venue)]));
    if (shares > 0n) steps.push(await step(`owner exits ${shares} shares`, call("owner-unwind",
      [Cl.principal(venue), sbtc, Cl.uint(shares), Cl.uint((shares * 99n) / 100n)])));
    const idle = amount(await read("balance-of", [Cl.principal(D), sbtc]));
    if (idle > 0n) steps.push(await step(`owner withdraws ${idle} sats`, call("withdraw", [sbtc, Cl.uint(idle)])));
  }
  fs.writeFileSync(record, JSON.stringify({ ...cfg, ownerSteps: steps }, null, 2) + "\n");
  console.log(`wrote ${record}`);
  process.exit(0);
}

if ((await sbtcBalance(D)) < DEPOSIT) throw new Error(`account 1 needs ${DEPOSIT} sats of testnet sBTC: see the README`);
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
// a venue that fits the venue trait but isn't on the owner's list, for the record of
// refusals: M1's mock venue, deployed by the same account
const unlistedVenue = `${D}.mock-venue`;
fs.writeFileSync(record, JSON.stringify({ ...cfg, owner: D, vault, venue, asset, unlistedVenue, limits, ownerSteps: steps }, null, 2) + "\n");
console.log(`wrote ${record}`);
