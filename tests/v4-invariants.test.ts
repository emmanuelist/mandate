import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// Invariant tests (#31): a seeded random walk through everything two owners and two
// delegates can do, checking after every step that
//   1. the vault's balance of each token equals the sum of the owners' idle balances,
//   2. the vault's shares in the venue equal the sum of the owners' positions,
//   3. no delegate's token balance ever grows,
// and, at random points and at the end, that every owner can exit completely.
// One seed is fixed; another is random and printed, so a failure can be replayed
// with INVARIANT_SEED=<seed>.
const a = simnet.getAccounts();
const dep = simnet.deployer;
const OWNERS = [a.get("wallet_1")!, a.get("wallet_2")!];
const DELEGATES = [a.get("wallet_3")!, dep];
const V = "mandate-vault-v4";
const VAULT = `${dep}.${V}`;
const TOKENS = ["mock-token", "mock-token-b"];
const VENUE = `${dep}.mock-venue`; // takes mock-token only
const MINT = 1_000_000;

const pp = (r: any) => Cl.prettyPrint(r);
const num = (s: string) => Number(s.match(/u(\d+)/)?.[1] ?? NaN);
const tok = (t: string) => Cl.contractPrincipal(dep, t);
const venue = () => Cl.contractPrincipal(dep, "mock-venue");
const walletOf = (who: string, t: string) => num(pp(simnet.callReadOnlyFn(t, "get-balance", [Cl.principal(who)], dep).result));
const idleOf = (who: string, t: string) => num(pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(who), Cl.principal(`${dep}.${t}`)], dep).result));
const posOf = (who: string) => num(pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(who), Cl.principal(VENUE)], dep).result));
const vaultShares = () => num(pp(simnet.callReadOnlyFn("mock-venue", "get-balance", [Cl.principal(VAULT)], dep).result));

// mulberry32: small, seedable, good enough to drive a test
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function check(step: number, label: string, delegateStart: Record<string, number>) {
  const where = `step ${step} (${label})`;
  for (const t of TOKENS) {
    const sum = OWNERS.reduce((s, o) => s + idleOf(o, t), 0);
    expect(walletOf(VAULT, t), `${where}: vault's ${t} vs the owners' idle balances`).toBe(sum);
  }
  expect(vaultShares(), `${where}: vault's venue shares vs the owners' positions`).toBe(OWNERS.reduce((s, o) => s + posOf(o), 0));
  for (const d of DELEGATES) for (const t of TOKENS) {
    expect(walletOf(d, t), `${where}: delegate ${d}'s ${t}`).toBeLessThanOrEqual(delegateStart[`${d}:${t}`]);
  }
}

function exitAll(owner: string, where: string) {
  const shares = posOf(owner);
  if (shares > 0) {
    const r = simnet.callPublicFn(V, "owner-unwind", [venue(), tok("mock-token"), Cl.uint(shares), Cl.uint(0)], owner);
    expect(r.result, `${where}: owner-unwind of all ${shares} shares`).toBeOk(expect.anything());
  }
  for (const t of TOKENS) {
    const idle = idleOf(owner, t);
    if (idle > 0) {
      expect(simnet.callPublicFn(V, "withdraw", [tok(t), Cl.uint(idle)], owner).result, `${where}: withdraw all ${idle} ${t}`).toBeOk(Cl.bool(true));
    }
  }
  expect(posOf(owner)).toBe(0);
  for (const t of TOKENS) expect(idleOf(owner, t)).toBe(0);
}

function walk(seed: number, steps: number) {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const upTo = (n: number) => Math.floor(r() * (n + 1));
  for (const t of TOKENS) simnet.callPublicFn(V, "set-cap", [Cl.principal(`${dep}.${t}`), Cl.uint(10_000_000)], dep);
  for (const o of OWNERS) for (const t of TOKENS) {
    simnet.callPublicFn(t, "mint", [Cl.uint(MINT), Cl.principal(o)], dep);
    simnet.callPublicFn(V, "allow-asset", [Cl.principal(`${dep}.${t}`)], o);
  }
  for (const o of OWNERS) simnet.callPublicFn(V, "allow-venue", [Cl.principal(VENUE), Cl.principal(`${dep}.mock-token`)], o);
  const delegateStart: Record<string, number> = {};
  for (const d of DELEGATES) for (const t of TOKENS) delegateStart[`${d}:${t}`] = walletOf(d, t);
  const counts: Record<string, number> = {};
  check(0, "setup", delegateStart);

  for (let step = 1; step <= steps; step++) {
    const owner = pick(OWNERS), delegate = pick(DELEGATES), t = pick(TOKENS);
    const action = pick(["deposit", "deposit", "deposit", "withdraw", "grant", "grant", "revoke", "allocate", "allocate", "allocate",
      "allocate", "unwind", "unwind", "owner-unwind", "haircut", "time", "exit"]);
    let res: any = null;
    switch (action) {
      case "deposit": res = simnet.callPublicFn(V, "deposit", [tok(t), Cl.uint(upTo(Math.min(walletOf(owner, t), 200_000)))], owner); break;
      case "withdraw": res = simnet.callPublicFn(V, "withdraw", [tok(t), Cl.uint(upTo(idleOf(owner, t) + 10))], owner); break;
      // mostly workable limits, with tight ones mixed in, so allocations both pass and fail
      case "grant": res = simnet.callPublicFn(V, "grant", [Cl.principal(delegate), Cl.uint(20_000 + upTo(280_000)),
        Cl.uint(simnet.burnBlockHeight + 100 + upTo(1_000)), Cl.uint(50 + upTo(450)), Cl.uint(2 + upTo(10)), Cl.uint(1 + upTo(200)),
        Cl.uint(50_000 + upTo(950_000)), Cl.uint(500 + upTo(9_500))], owner); break;
      case "revoke": res = simnet.callPublicFn(V, "revoke", [Cl.principal(delegate)], owner); break;
      case "allocate": res = simnet.callPublicFn(V, "allocate", [Cl.principal(owner), venue(), tok("mock-token"),
        Cl.uint(1 + upTo(Math.floor(idleOf(owner, "mock-token") * 0.6)))], delegate); break;
      case "unwind": res = simnet.callPublicFn(V, "unwind", [Cl.principal(owner), venue(), tok("mock-token"),
        Cl.uint(upTo(posOf(owner) + 10))], delegate); break;
      case "owner-unwind": res = simnet.callPublicFn(V, "owner-unwind", [venue(), tok("mock-token"),
        Cl.uint(upTo(posOf(owner) + 10)), Cl.uint(0)], owner); break;
      case "haircut": res = simnet.callPublicFn("mock-venue", "set-haircut", [Cl.uint(upTo(150))], dep); break;
      case "time": simnet.mineEmptyBurnBlocks(1 + upTo(80)); break;
      case "exit": exitAll(owner, `step ${step}`); break;
    }
    const outcome = res === null ? "done" : pp(res.result).startsWith("(ok") ? "ok" : "refused";
    counts[`${action} ${outcome}`] = (counts[`${action} ${outcome}`] ?? 0) + 1;
    check(step, action, delegateStart);
  }
  for (const o of OWNERS) exitAll(o, "the end");
  check(steps + 1, "everyone exits", delegateStart);
  expect(walletOf(VAULT, "mock-token")).toBe(0);
  expect(walletOf(VAULT, "mock-token-b")).toBe(0);
  expect(vaultShares()).toBe(0);
  return counts;
}

const summary = (c: Record<string, number>) => Object.entries(c).sort().map(([k, v]) => `${k} ${v}`).join(", ");

// A walk takes about 2 s locally and up to 10 s on CI's runners. Over 61 random
// seeds, successful allocations ranged from 12 to 49 and unwinds and exits never
// fell below 31: the fixed seed must reach 15 of each, a random seed 5 and 15.
const TIMEOUT = 60_000;
describe("v4 invariants over random sequences", () => {
  const exercised = (c: Record<string, number>, minAllocations: number) => {
    expect(c["allocate ok"] ?? 0, "successful allocations").toBeGreaterThanOrEqual(minAllocations);
    expect((c["unwind ok"] ?? 0) + (c["owner-unwind ok"] ?? 0) + (c["exit done"] ?? 0), "unwinds and exits").toBeGreaterThanOrEqual(15);
  };
  it("invariants: 400 random steps across two owners and two delegates, fixed seed", () => {
    const counts = walk(20261014, 400);
    console.log("  seed 20261014           :", summary(counts));
    exercised(counts, 15);
  }, TIMEOUT);
  it("invariants: 400 random steps, from a random seed printed for replay", () => {
    const seed = Number(process.env.INVARIANT_SEED ?? Math.floor(Math.random() * 2 ** 31));
    console.log(`  random seed ${seed} (replay with INVARIANT_SEED=${seed})`);
    const counts = walk(seed, 400);
    console.log("  seed", seed, "          :", summary(counts));
    exercised(counts, 5);
  }, TIMEOUT);
});
