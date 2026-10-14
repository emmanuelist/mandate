// Testnet accounts and transaction helpers for the M1 testnet run (#7).
// Account 1 deploys and owns; account 2 is the delegate. The seed is read from
// the gitignored settings/Testnet.toml and never printed, nor is any key.
// Run directly to print both addresses and their STX balances.
import fs from "node:fs";
import { broadcastTransaction } from "@stacks/transactions";
import { generateWallet, generateNewAccount, getStxAddress } from "@stacks/wallet-sdk";

export const API = "https://api.testnet.hiro.so";

// The Clarity version Clarinet.toml gives a contract, so testnet runs what the tests run.
export function clarityVersionOf(name) {
  const section = fs.readFileSync("Clarinet.toml", "utf8").split(/^\[/m)
    .find((s) => s.startsWith(`contracts.${name}]`));
  const version = Number(section?.match(/^clarity_version\s*=\s*(\d+)/m)?.[1]);
  if (!version) throw new Error(`Clarinet.toml gives no clarity_version for ${name}`);
  return version;
}

export async function testnetAccounts() {
  const mnemonic = (fs.readFileSync("settings/Testnet.toml", "utf8")
    .match(/mnemonic\s*=\s*"([^"]+)"/) || [])[1];
  if (!mnemonic || mnemonic.includes("PASTE YOUR")) {
    throw new Error("No seed in settings/Testnet.toml: replace the placeholder with a testnet-only seed");
  }
  let wallet = await generateWallet({ secretKey: mnemonic, password: "" });
  wallet = generateNewAccount(wallet);
  return wallet.accounts.slice(0, 2).map((a) => ({ address: getStxAddress(a, "testnet"), key: a.stxPrivateKey }));
}

export async function broadcast(transaction, label) {
  const res = await broadcastTransaction({ transaction, network: "testnet" });
  if (!res.txid || res.error) throw new Error(`${label}: rejected: ${res.error ?? ""} ${res.reason ?? ""}`.trim());
  return res.txid.startsWith("0x") ? res.txid : `0x${res.txid}`;
}

// Polls until the transaction confirms; throws if it aborts or takes too long.
export async function waitFor(txid, label, timeoutMs = 20 * 60_000) {
  for (const start = Date.now(); Date.now() - start < timeoutMs; ) {
    const r = await fetch(`${API}/extended/v1/tx/${txid}`);
    if (r.ok) {
      const d = await r.json();
      if (d.tx_status === "success") return { block: d.block_height, result: d.tx_result?.repr };
      if (String(d.tx_status).startsWith("abort")) throw new Error(`${label}: ${d.tx_status} ${d.tx_result?.repr ?? ""}`);
    }
    await new Promise((s) => setTimeout(s, 10_000));
  }
  throw new Error(`${label}: not confirmed within ${timeoutMs / 60_000} minutes (${txid})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [i, { address }] of (await testnetAccounts()).entries()) {
    const r = await fetch(`${API}/extended/v1/address/${address}/stx`);
    const stx = r.ok ? Number((await r.json()).balance) / 1e6 : NaN;
    console.log(`account ${i + 1} (${i === 0 ? "owner, deployer" : "delegate"}): ${address}  ${stx} STX`);
  }
}
