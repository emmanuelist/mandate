#!/usr/bin/env node
// Runs the four mainnet proof calls and prints the tx hashes.
//
// Your seed never leaves this machine: it is read from settings/Mainnet.toml,
// used locally to sign, and never printed or transmitted anywhere but the
// Stacks node. Read this file before running it.
//
//   node run-mainnet-proof.mjs            # dry run, signs nothing
//   node run-mainnet-proof.mjs --broadcast

import fs from "node:fs";
import { generateWallet } from "@stacks/wallet-sdk";
import {
  makeContractCall, broadcastTransaction, Cl, PostConditionMode, fetchNonce,
} from "@stacks/transactions";

const AMOUNT   = Number(process.env.AMOUNT ?? 100);        // sats
const BROADCAST = process.argv.includes("--broadcast");
const API      = "https://api.hiro.so";
const DEPLOYER = "SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH";
const CONTRACT = "mandate-probe-mainnet";
const SBTC     = ["SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token"];

const mnemonic = (fs.readFileSync("settings/Mainnet.toml", "utf8")
  .match(/mnemonic\s*=\s*"([^"]+)"/) || [])[1];
if (!mnemonic || mnemonic.includes("PASTE YOUR")) {
  console.error("No seed phrase in settings/Mainnet.toml"); process.exit(1);
}
const wallet = await generateWallet({ secretKey: mnemonic, password: "" });
const senderKey = wallet.accounts[0].stxPrivateKey;

const sbtc = () => Cl.contractPrincipal(...SBTC);
const steps = [
  { fn: "fund",     args: () => [sbtc(), Cl.uint(AMOUNT)],  note: "contract custodies real sBTC" },
  { fn: "allocate", args: () => [Cl.uint(AMOUNT), Cl.uint(1)], note: "A CONTRACT DEPOSITS INTO ZEST" },
  { fn: "unwind",   args: (s) => [Cl.uint(s.shares), Cl.uint(1)], note: "position closes" },
  { fn: "rescue",   args: (s) => [sbtc(), Cl.uint(s.back)], note: "owner gets funds back" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(txid) {
  for (let i = 0; i < 120; i++) {
    const r = await fetch(`${API}/extended/v1/tx/${txid}`).then((x) => x.json()).catch(() => ({}));
    if (r.tx_status === "success") return r;
    if (r.tx_status && r.tx_status !== "pending") throw new Error(`${txid} -> ${r.tx_status}`);
    await sleep(5000);
  }
  throw new Error(`timed out waiting for ${txid}`);
}

console.log(`\nsender   : ${wallet.accounts[0].address ?? DEPLOYER}`);
console.log(`contract : ${DEPLOYER}.${CONTRACT}`);
console.log(`amount   : ${AMOUNT} sats`);
console.log(BROADCAST ? "mode     : BROADCAST (real funds)\n" : "mode     : dry run, nothing signed\n");

if (!BROADCAST) {
  steps.forEach((s, i) => console.log(`  ${i + 1}. ${s.fn.padEnd(9)} ${s.note}`));
  console.log("\nRe-run with --broadcast to execute.\n");
  process.exit(0);
}

const state = {}; const hashes = [];
let nonce = await fetchNonce({ address: DEPLOYER, network: "mainnet" });
for (const [i, step] of steps.entries()) {
  const tx = await makeContractCall({
    contractAddress: DEPLOYER, contractName: CONTRACT, functionName: step.fn,
    functionArgs: step.args(state), senderKey, network: "mainnet",
    postConditionMode: PostConditionMode.Allow, fee: 3000, nonce: nonce++,
  });
  const res = await broadcastTransaction({ transaction: tx, network: "mainnet" });
  if (res.error) throw new Error(`${step.fn}: ${res.error} ${res.reason ?? ""}`);
  const txid = res.txid;
  console.log(`  ${i + 1}. ${step.fn.padEnd(9)} 0x${txid}  ...waiting`);
  const done = await waitFor(txid);
  const repr = done.tx_result?.repr ?? "";
  console.log(`     -> ${repr}   (${step.note})`);
  hashes.push(`${step.fn}: 0x${txid}  ${repr}`);
  const n = Number((repr.match(/^\(ok u(\d+)\)$/) || [])[1] ?? 0);
  if (step.fn === "allocate") state.shares = n;
  if (step.fn === "unwind")   state.back = n;
}
console.log("\n=== tx hashes for the application ===");
hashes.forEach((h) => console.log("  " + h));
