// The reference delegate (#33): a small agent that holds only its own key, from
// settings/Delegate-<network>.toml. Each round it reads its mandate, its counters,
// the owner's idle balance and position, and the venue's quotes, then moves toward
// a target share of the owner's funds in the venue: allocating when below,
// unwinding when above, within every limit it can read. It only ever calls
// allocate and unwind. It signs with deny-mode post-conditions, so its own
// transactions can't move more than it intends.
//
// usage: node scripts/delegate.mjs <network> [target-bps,...]
//   e.g. node scripts/delegate.mjs testnet 7500,2500,7500
// Reads deployments/<network>-delegate.json, which the owner's side writes, and
// appends each round to deployments/<network>-delegate-run.json.
import fs from "node:fs";
import {
  makeContractCall, broadcastTransaction, fetchCallReadOnlyFunction, privateKeyToAddress,
  Cl, ClarityType, Pc, PostConditionMode,
} from "@stacks/transactions";

const BPS = 10_000n;
const DAY = 144n; // the vault's day, in Bitcoin blocks

const min = (...xs) => xs.reduce((a, b) => (b < a ? b : a));

// What to do this round, from what the delegate can read. Pure, so it's testable.
export function decide(s, targetBps) {
  if (!s.mandate) return { action: "stop", why: "no mandate from this owner" };
  const m = s.mandate, c = s.counters;
  if (s.burn >= m.expires) return { action: "stop", why: "the mandate has expired" };
  const windowOpen = s.burn >= c.windowStart + m.windowLen;
  const tradesLeft = windowOpen ? m.maxTrades : m.maxTrades - c.windowCount;
  if (tradesLeft <= 0n) return { action: "wait", why: "the rate window is used up" };
  const total = s.idle + s.value;
  const target = (total * BigInt(targetBps)) / BPS;
  const band = total / 100n; // within 1% of the target is close enough: no churn for dust
  if (s.value + band < target) {
    const dayOpen = s.burn >= c.dayStart + DAY;
    const dayLeft = dayOpen ? m.maxDaily : m.maxDaily - c.dayNotional;
    const amount = min(target - s.value, s.idle, m.maxNotional, dayLeft);
    if (amount <= 0n) return { action: "hold", why: "no room under the per-move or daily cap" };
    return { action: "allocate", amount, why: `below target: ${s.value} of ${target}` };
  }
  if (s.value > target + band && s.value > 0n) {
    const shares = (s.shares * (s.value - target)) / s.value;
    if (shares <= 0n) return { action: "hold", why: "too little above target to unwind" };
    return { action: "unwind", shares, why: `above target: ${s.value} of ${target}` };
  }
  return { action: "hold", why: "within 1% of the target" };
}

const asNum = (v) => BigInt(v.value);
const tupleField = (t, k) => asNum(t.value[k]);

async function main() {
  const [network = "testnet", targetsArg = "7500,2500"] = process.argv.slice(2);
  if (!["testnet", "mainnet"].includes(network)) throw new Error(`unknown network ${network}`);
  const API = network === "mainnet" ? "https://api.hiro.so" : "https://api.testnet.hiro.so";
  const key = (fs.readFileSync(`settings/Delegate-${network}.toml`, "utf8").match(/privateKey\s*=\s*"([0-9a-f]+)"/) || [])[1];
  if (!key) throw new Error(`no key in settings/Delegate-${network}.toml: run npm run delegate:key -- ${network}`);
  const me = privateKeyToAddress(key, network);
  const cfg = JSON.parse(fs.readFileSync(`deployments/${network}-delegate.json`, "utf8"));
  if (cfg.delegate !== me) throw new Error(`deployments/${network}-delegate.json names ${cfg.delegate}, but this key is ${me}`);
  const split = (id) => { const [a, n] = id.split("."); return { a, n }; };
  const vault = split(cfg.vault), venue = split(cfg.venue), asset = split(cfg.asset);
  const read = async (c, fn, args) => fetchCallReadOnlyFunction({
    contractAddress: c.a, contractName: c.n, functionName: fn, functionArgs: args, senderAddress: me, network });
  const tokenName = async (c) => (await fetch(`${API}/v2/contracts/interface/${c.a}/${c.n}`).then((r) => r.json())).fungible_tokens[0].name;
  const assetToken = await tokenName(asset), shareToken = await tokenName(venue);
  const owner = Cl.principal(cfg.owner), V = Cl.principal(cfg.venue), A = Cl.principal(cfg.asset);

  async function state() {
    const burn = BigInt((await fetch(`${API}/v2/info`).then((r) => r.json())).burn_block_height);
    const mo = await read(vault, "mandate-of", [owner, Cl.principal(me)]);
    const mandate = mo.type === ClarityType.OptionalSome ? {
      maxNotional: tupleField(mo.value, "max-notional"), expires: tupleField(mo.value, "expires"),
      maxSlipBps: tupleField(mo.value, "max-slip-bps"), maxTrades: tupleField(mo.value, "max-trades-per-window"),
      windowLen: tupleField(mo.value, "window-len"), maxDaily: tupleField(mo.value, "max-daily-notional"),
    } : null;
    const ct = await read(vault, "counters-of", [owner, Cl.principal(me)]);
    const counters = { windowStart: tupleField(ct, "window-start"), windowCount: tupleField(ct, "window-count"),
      dayStart: tupleField(ct, "day-start"), dayNotional: tupleField(ct, "day-notional") };
    const idle = asNum(await read(vault, "balance-of", [owner, A]));
    const shares = asNum(await read(vault, "shares-of", [owner, V]));
    const value = shares > 0n ? asNum((await read(venue, "convert-to-assets", [Cl.uint(shares)])).value) : 0n;
    return { burn, mandate, counters, idle, shares, value };
  }

  async function send(fn, args, postConditions) {
    const nonce = BigInt((await fetch(`${API}/extended/v1/address/${me}/nonces`).then((r) => r.json())).possible_next_nonce);
    const tx = await makeContractCall({
      contractAddress: vault.a, contractName: vault.n, functionName: fn, functionArgs: args,
      senderKey: key, network, nonce, fee: 100_000n, postConditionMode: PostConditionMode.Deny, postConditions,
    });
    const res = await broadcastTransaction({ transaction: tx, network });
    if (!res.txid || res.error) throw new Error(`${fn}: rejected: ${res.error ?? ""} ${res.reason ?? ""}`);
    const txid = res.txid.startsWith("0x") ? res.txid : `0x${res.txid}`;
    for (let i = 0; i < 120; i++) {
      const d = await fetch(`${API}/extended/v1/tx/${txid}`).then((r) => (r.ok ? r.json() : null));
      if (d?.tx_status === "success") return { txid, block: d.block_height, result: d.tx_result?.repr };
      if (String(d?.tx_status).startsWith("abort")) throw new Error(`${fn} ${txid}: ${d.tx_status} ${d.tx_result?.repr ?? ""}`);
      await new Promise((r) => setTimeout(r, 10_000));
    }
    throw new Error(`${fn} ${txid}: not confirmed in 20 minutes`);
  }

  const runFile = `deployments/${network}-delegate-run.json`;
  const run = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, "utf8")) : { network, delegate: me, owner: cfg.owner, rounds: [] };
  console.log(`delegate ${me} for owner ${cfg.owner}, vault ${cfg.vault}, venue ${cfg.venue}`);
  for (const targetBps of targetsArg.split(",").map(Number)) {
    const s = await state();
    const d = decide(s, targetBps);
    const round = { at: new Date().toISOString(), burn: Number(s.burn), targetBps, idle: String(s.idle), value: String(s.value), action: d.action, why: d.why };
    if (d.action === "allocate") {
      Object.assign(round, await send("allocate", [owner, V, A, Cl.uint(d.amount)],
        [Pc.principal(cfg.vault).willSendEq(d.amount).ft(cfg.asset, assetToken)]), { amount: String(d.amount) });
    } else if (d.action === "unwind") {
      const quote = asNum((await read(venue, "convert-to-assets", [Cl.uint(d.shares)])).value);
      const floor = (quote * (BPS - s.mandate.maxSlipBps)) / BPS;
      Object.assign(round, await send("unwind", [owner, V, A, Cl.uint(d.shares)], [
        Pc.principal(cfg.vault).willSendEq(d.shares).ft(cfg.venue, shareToken),
        Pc.principal(cfg.venue).willSendGte(floor).ft(cfg.asset, assetToken),
      ]), { shares: String(d.shares) });
    }
    console.log(`  target ${String(targetBps).padStart(5)} bps: ${d.action.padEnd(8)} ${d.why}${round.txid ? ` -> ${round.result}, block ${round.block}, ${round.txid}` : ""}`);
    run.rounds.push(round);
    fs.writeFileSync(runFile, JSON.stringify(run, null, 2) + "\n");
    if (d.action === "stop") break;
  }
  console.log(`wrote ${runFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
