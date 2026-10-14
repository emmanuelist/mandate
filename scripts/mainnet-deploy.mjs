// Deploys the contracts that go to mainnet (#34), the ones Clarinet-review.toml lists,
// in its order, from account 1 of settings/Mainnet.toml, then sets each asset's cap
// once (D-018, D-020) and reads it back. A contract already deployed with the repo's
// source is skipped, and one deployed from different source stops the run, since a
// name can't be deployed twice.
//
//   node scripts/mainnet-deploy.mjs              dry run: reads no key and signs nothing.
//                                                Prints each step with its estimated fee,
//                                                and the deployer's balance against the total
//   node scripts/mainnet-deploy.mjs --broadcast  sends them, one at a time, each confirmed
//                                                before the next
//
// Only --broadcast reads the seed, in this process, and it is never printed. It stops
// unless the seed's first account is the expected deployer. Writes deployments/mainnet.json.
import fs from "node:fs";
import {
  makeContractDeploy, makeContractCall, makeUnsignedContractDeploy, makeUnsignedContractCall,
  fetchFeeEstimateTransaction, estimateTransactionByteLength, serializePayloadBytes, fetchNonce,
  fetchCallReadOnlyFunction, broadcastTransaction, randomPrivateKey, privateKeyToPublic, Cl, PostConditionMode,
} from "@stacks/transactions";
import { bytesToHex } from "@stacks/common";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";

const API = "https://api.hiro.so";
const DEPLOYER = "SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH"; // account 1 of settings/Mainnet.toml, which deployed the probe
const VAULT = "mandate-vault-v5";
// each asset's cap, set once and never raised (D-018, D-020)
const CAPS = [
  { asset: "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token", cap: 1_000_000n, label: "sBTC: 1,000,000 sats, 0.01 BTC" },
  { asset: "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx", cap: 1_000_000_000n, label: "USDCx: 1,000 USDCx at 6 decimals" },
];
// Hiro's estimator gives a low, a medium and a high fee; each transaction pays the
// medium, and --broadcast stops rather than pay more than this for any one of them
const MAX_FEE = 2_000_000n;
const BROADCAST = process.argv.includes("--broadcast");

const contracts = fs.readFileSync("Clarinet-review.toml", "utf8").split(/^\[/m)
  .map((s) => ({ name: s.match(/^contracts\.([\w-]+)\]/)?.[1], clarityVersion: Number(s.match(/^clarity_version\s*=\s*(\d+)/m)?.[1]) }))
  .filter((c) => c.name);
const get = (path) => fetch(`${API}${path}`).then((r) => (r.ok ? r.json() : null));
const stx = (micro) => `${(Number(micro) / 1e6).toFixed(6)} STX`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// the estimator's low, medium and high fees for a transaction, from its payload and
// length alone. A call to a contract not yet deployed has no estimate: it is budgeted at
// the highest medium seen so far, which a deploy, the costlier kind, sets
let highestMedium = 0n;
async function feeOf(tx) {
  try {
    const est = await fetchFeeEstimateTransaction({ payload: bytesToHex(serializePayloadBytes(tx.payload)),
      estimatedLength: estimateTransactionByteLength(tx), network: "mainnet" });
    const [low, fee, high] = est.map((e) => BigInt(e.fee));
    if (fee > highestMedium) highestMedium = fee;
    return { fee, note: `low ${stx(low)}, medium ${stx(fee)}, high ${stx(high)}` };
  } catch {
    return { fee: highestMedium, note: `no estimate before the vault exists; budgeted at ${stx(highestMedium)}` };
  }
}
const guard = (fee, label) => {
  if (fee > MAX_FEE) throw new Error(`${label}: the estimated fee ${stx(fee)} is above the ${stx(MAX_FEE)} ceiling; wait for a quieter fee market`);
};

async function waitFor(txid, label) {
  for (let i = 0; i < 360; i++) {
    const d = await get(`/extended/v1/tx/${txid}`);
    if (d?.tx_status === "success") return { block: d.block_height, result: d.tx_result?.repr, fee: d.fee_rate };
    if (String(d?.tx_status).startsWith("abort")) throw new Error(`${label}: ${d.tx_status} ${d.tx_result?.repr ?? ""} (${txid})`);
    await sleep(10_000);
  }
  throw new Error(`${label}: not confirmed within an hour (${txid})`);
}

async function signer() {
  if (!fs.existsSync("settings/Mainnet.toml")) throw new Error("no settings/Mainnet.toml");
  const mnemonic = (fs.readFileSync("settings/Mainnet.toml", "utf8").match(/mnemonic\s*=\s*"([^"]+)"/) || [])[1];
  if (!mnemonic || mnemonic.includes("PASTE YOUR")) throw new Error("no seed in settings/Mainnet.toml");
  const account = (await generateWallet({ secretKey: mnemonic, password: "" })).accounts[0];
  const address = getStxAddress(account, "mainnet");
  if (address !== DEPLOYER) throw new Error(`settings/Mainnet.toml's first account is ${address}, not the deployer ${DEPLOYER}`);
  return account.stxPrivateKey;
}

const key = BROADCAST ? await signer() : null;
const publicKey = privateKeyToPublic(randomPrivateKey()); // the dry run's stand-in: sizes, not signatures
console.log(`deployer ${DEPLOYER}, ${BROADCAST ? "BROADCAST: real transactions on mainnet" : "dry run: no key read, nothing signed or sent"}`);

const record = fs.existsSync("deployments/mainnet.json")
  ? JSON.parse(fs.readFileSync("deployments/mainnet.json", "utf8"))
  : { network: "mainnet", deployer: DEPLOYER, contracts: {}, caps: {} };
let total = 0n;

for (const { name, clarityVersion } of contracts) {
  const id = `${DEPLOYER}.${name}`;
  const source = fs.readFileSync(`contracts/${name}.clar`, "utf8");
  const existing = await get(`/extended/v1/contract/${id}`);
  if (existing?.tx_id) {
    if (existing.source_code !== source || existing.clarity_version !== clarityVersion) {
      throw new Error(`${id} is deployed from a different contracts/${name}.clar, and a name can't be deployed twice`);
    }
    console.log(`  ${name.padEnd(17)} already deployed, identical to the repo, block ${existing.block_height}`);
    record.contracts[name] ??= { id, txid: existing.tx_id, block: existing.block_height };
    continue;
  }
  const deploy = (fee, nonce) => BROADCAST
    ? makeContractDeploy({ contractName: name, codeBody: source, clarityVersion, senderKey: key, network: "mainnet", fee, nonce,
        postConditionMode: PostConditionMode.Deny })
    : makeUnsignedContractDeploy({ contractName: name, codeBody: source, clarityVersion, publicKey, network: "mainnet", fee, nonce,
        postConditionMode: PostConditionMode.Deny });
  const { fee, note } = await feeOf(await deploy(0n, 0n));
  total += fee;
  if (!BROADCAST) { console.log(`  deploy ${name.padEnd(17)} ${String(source.length).padStart(6)} bytes, Clarity ${clarityVersion}: ${note}`); continue; }
  guard(fee, name);
  const nonce = await fetchNonce({ address: DEPLOYER, network: "mainnet" });
  const res = await broadcastTransaction({ transaction: await deploy(fee, nonce), network: "mainnet" });
  if (!res.txid || res.error) throw new Error(`${name}: rejected: ${res.error ?? ""} ${res.reason ?? ""}`);
  const txid = res.txid.startsWith("0x") ? res.txid : `0x${res.txid}`;
  process.stdout.write(`  deploy ${name.padEnd(17)} ${txid} ... `);
  const { block } = await waitFor(txid, name);
  console.log(`block ${block}, fee ${stx(fee)}`);
  record.contracts[name] = { id, txid, block, fee: String(fee) };
  fs.writeFileSync("deployments/mainnet.json", JSON.stringify(record, null, 2) + "\n");
}

const vault = `${DEPLOYER}.${VAULT}`;
const vaultLive = Boolean(await get(`/extended/v1/contract/${vault}`));
for (const { asset, cap, label } of CAPS) {
  const current = vaultLive ? Cl.prettyPrint(await fetchCallReadOnlyFunction({ contractAddress: DEPLOYER, contractName: VAULT,
    functionName: "cap-of", functionArgs: [Cl.principal(asset)], senderAddress: DEPLOYER, network: "mainnet" })) : "u0";
  if (current !== "u0") {
    if (current !== `u${cap}`) throw new Error(`${asset}'s cap is ${current}, not u${cap}, and it can't change`);
    console.log(`  cap ${label}: already set, ${current}`);
    record.caps[asset] ??= { cap: String(cap) };
    continue;
  }
  const call = (fee, nonce) => BROADCAST
    ? makeContractCall({ contractAddress: DEPLOYER, contractName: VAULT, functionName: "set-cap", functionArgs: [Cl.principal(asset), Cl.uint(cap)],
        senderKey: key, network: "mainnet", fee, nonce, postConditionMode: PostConditionMode.Deny })
    : makeUnsignedContractCall({ contractAddress: DEPLOYER, contractName: VAULT, functionName: "set-cap", functionArgs: [Cl.principal(asset), Cl.uint(cap)],
        publicKey, network: "mainnet", fee, nonce, postConditionMode: PostConditionMode.Deny });
  const { fee, note } = await feeOf(await call(0n, 0n));
  total += fee;
  if (!BROADCAST) { console.log(`  set-cap ${label}: ${note}`); continue; }
  guard(fee, `set-cap ${asset}`);
  const nonce = await fetchNonce({ address: DEPLOYER, network: "mainnet" });
  const res = await broadcastTransaction({ transaction: await call(fee, nonce), network: "mainnet" });
  if (!res.txid || res.error) throw new Error(`set-cap ${asset}: rejected: ${res.error ?? ""} ${res.reason ?? ""}`);
  const txid = res.txid.startsWith("0x") ? res.txid : `0x${res.txid}`;
  process.stdout.write(`  set-cap ${label} ${txid} ... `);
  const { block, result } = await waitFor(txid, "set-cap");
  const readBack = Cl.prettyPrint(await fetchCallReadOnlyFunction({ contractAddress: DEPLOYER, contractName: VAULT,
    functionName: "cap-of", functionArgs: [Cl.principal(asset)], senderAddress: DEPLOYER, network: "mainnet" }));
  if (readBack !== `u${cap}`) throw new Error(`${asset}'s cap reads back as ${readBack}, not u${cap}`);
  console.log(`${result}, block ${block}, reads back ${readBack}`);
  record.caps[asset] = { cap: String(cap), txid, block, fee: String(fee) };
  fs.writeFileSync("deployments/mainnet.json", JSON.stringify(record, null, 2) + "\n");
}

const balance = BigInt((await get(`/extended/v1/address/${DEPLOYER}/stx`))?.balance ?? 0);
console.log(`${BROADCAST ? "spent" : "budget at the medium estimates"} ${stx(total)}; the deployer ${BROADCAST ? "now holds" : "holds"} ${stx(balance)}`);
if (!BROADCAST && balance < total) console.log("  the deployer needs more STX before --broadcast");
if (BROADCAST) console.log("wrote deployments/mainnet.json");
