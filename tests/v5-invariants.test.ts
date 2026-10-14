import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// Invariant tests (#31): a seeded random walk through everything two owners and two
// delegates can do, across two venues, one of which calls back into the vault at
// random points (#48). After every step it checks that
//   1. the vault's balance of each token equals the idle balances it records, for
//      every account that could hold one, the calling-back venue included,
//   2. the vault's shares in each venue equal the owners' positions there,
//   3. no delegate's token balance ever grows,
// and, at random points and at the end, that every owner can exit completely.
// One seed is fixed; another is random and printed, so a failure can be replayed
// with INVARIANT_SEED=<seed>. INVARIANT_VAULT=mandate-vault-v4 walks v4 instead,
// with the calling-back venue aimed at it, to show the walk catches v4's flaw.
const a = simnet.getAccounts();
const dep = simnet.deployer;
const OWNERS = [a.get("wallet_1")!, a.get("wallet_2")!];
const DELEGATES = [a.get("wallet_3")!, dep];
const V = process.env.INVARIANT_VAULT ?? "mandate-vault-v5";
const RV = V === "mandate-vault-v4" ? "reentrant-venue-v4" : "reentrant-venue";
const VAULT = `${dep}.${V}`;
const TOKENS = ["mock-token", "mock-token-b"];
const VENUES = ["mock-venue", RV]; // both take mock-token only
const HOLDERS = [...OWNERS, ...DELEGATES, `${dep}.${RV}`];
const MINT = 1_000_000;

const pp = (r: any) => Cl.prettyPrint(r);
const num = (s: string) => Number(s.match(/u(\d+)/)?.[1] ?? NaN);
const tok = (t: string) => Cl.contractPrincipal(dep, t);
const ven = (v: string) => Cl.contractPrincipal(dep, v);
const walletOf = (who: string, t: string) => num(pp(simnet.callReadOnlyFn(t, "get-balance", [Cl.principal(who)], dep).result));
const idleOf = (who: string, t: string) => num(pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(who), Cl.principal(`${dep}.${t}`)], dep).result));
const posOf = (who: string, v: string) => num(pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(who), Cl.principal(`${dep}.${v}`)], dep).result));
// the calling-back venue's getter is public and counts reads, so read its ledger directly
const vaultShares = (v: string) => v === "mock-venue"
  ? num(pp(simnet.callReadOnlyFn(v, "get-balance", [Cl.principal(VAULT)], dep).result))
  : num(pp(simnet.callReadOnlyFn(v, "shares-held", [Cl.principal(VAULT)], dep).result));
const tally = () => {
  const t = pp(simnet.callReadOnlyFn(RV, "tally", [], dep).result);
  return { attempts: num(t.match(/attempts: (u\d+)/)![1]), refusals: num(t.match(/refusals: (u\d+)/)![1]) };
};

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
    const sum = HOLDERS.reduce((s, h) => s + idleOf(h, t), 0);
    expect(walletOf(VAULT, t), `${where}: vault's ${t} vs the idle balances it records`).toBe(sum);
  }
  for (const v of VENUES) {
    expect(vaultShares(v), `${where}: vault's shares in ${v} vs the owners' positions`).toBe(OWNERS.reduce((s, o) => s + posOf(o, v), 0));
  }
  for (const d of DELEGATES) for (const t of TOKENS) {
    expect(walletOf(d, t), `${where}: delegate ${d}'s ${t}`).toBeLessThanOrEqual(delegateStart[`${d}:${t}`]);
  }
}

function exitAll(owner: string, where: string) {
  for (const v of VENUES) {
    const shares = posOf(owner, v);
    if (shares > 0) {
      const r = simnet.callPublicFn(V, "owner-unwind", [ven(v), tok("mock-token"), Cl.uint(shares), Cl.uint(0)], owner);
      expect(r.result, `${where}: owner-unwind of all ${shares} shares in ${v}`).toBeOk(expect.anything());
    }
  }
  for (const t of TOKENS) {
    const idle = idleOf(owner, t);
    if (idle > 0) {
      expect(simnet.callPublicFn(V, "withdraw", [tok(t), Cl.uint(idle)], owner).result, `${where}: withdraw all ${idle} ${t}`).toBeOk(Cl.bool(true));
    }
  }
  for (const v of VENUES) expect(posOf(owner, v)).toBe(0);
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
  for (const o of OWNERS) for (const v of VENUES) simnet.callPublicFn(V, "allow-venue", [Cl.principal(`${dep}.${v}`), Cl.principal(`${dep}.mock-token`)], o);
  // the calling-back venue holds tokens of its own and has listed mock-token for itself
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(MINT), Cl.principal(`${dep}.${RV}`)], dep);
  expect(simnet.callPublicFn(RV, "setup", [], dep).result).toBeOk(Cl.bool(true));
  const delegateStart: Record<string, number> = {};
  for (const d of DELEGATES) for (const t of TOKENS) delegateStart[`${d}:${t}`] = walletOf(d, t);
  const counts: Record<string, number> = {};
  check(0, "setup", delegateStart);

  for (let step = 1; step <= steps; step++) {
    const owner = pick(OWNERS), delegate = pick(DELEGATES), t = pick(TOKENS), v = pick(VENUES);
    const action = pick(["deposit", "deposit", "deposit", "withdraw", "grant", "grant", "revoke", "allocate", "allocate", "allocate",
      "allocate", "unwind", "unwind", "owner-unwind", "haircut", "time", "exit", "rearm", "rearm"]);
    let res: any = null;
    switch (action) {
      case "deposit": res = simnet.callPublicFn(V, "deposit", [tok(t), Cl.uint(upTo(Math.min(walletOf(owner, t), 200_000)))], owner); break;
      case "withdraw": res = simnet.callPublicFn(V, "withdraw", [tok(t), Cl.uint(upTo(idleOf(owner, t) + 10))], owner); break;
      // mostly workable limits, with tight ones mixed in, so allocations both pass and fail
      case "grant": res = simnet.callPublicFn(V, "grant", [Cl.principal(delegate), Cl.uint(20_000 + upTo(280_000)),
        Cl.uint(simnet.burnBlockHeight + 100 + upTo(1_000)), Cl.uint(50 + upTo(450)), Cl.uint(2 + upTo(10)), Cl.uint(1 + upTo(200)),
        Cl.uint(50_000 + upTo(950_000)), Cl.uint(500 + upTo(9_500))], owner); break;
      case "revoke": res = simnet.callPublicFn(V, "revoke", [Cl.principal(delegate)], owner); break;
      case "allocate": res = simnet.callPublicFn(V, "allocate", [Cl.principal(owner), ven(v), tok("mock-token"),
        Cl.uint(1 + upTo(Math.floor(idleOf(owner, "mock-token") * 0.6)))], delegate); break;
      case "unwind": res = simnet.callPublicFn(V, "unwind", [Cl.principal(owner), ven(v), tok("mock-token"),
        Cl.uint(upTo(posOf(owner, v) + 10))], delegate); break;
      case "owner-unwind": res = simnet.callPublicFn(V, "owner-unwind", [ven(v), tok("mock-token"),
        Cl.uint(upTo(posOf(owner, v) + 10)), Cl.uint(0)], owner); break;
      case "haircut": res = simnet.callPublicFn("mock-venue", "set-haircut", [Cl.uint(upTo(150))], dep); break;
      case "time": simnet.mineEmptyBurnBlocks(1 + upTo(80)); break;
      case "exit": exitAll(owner, `step ${step}`); break;
      // arm the venue to call back once, at a random point, with a deposit or a
      // withdrawal of its own; it ignores a refusal and carries on honestly
      case "rearm": res = simnet.callPublicFn(RV, "arm", [Cl.uint(upTo(5)), Cl.uint(1 + upTo(1)), Cl.uint(1 + upTo(100_000)),
        Cl.principal(owner), Cl.bool(false)], dep); break;
    }
    const outcome = res === null ? "done" : pp(res.result).startsWith("(ok") ? "ok" : "refused";
    counts[`${action} ${outcome}`] = (counts[`${action} ${outcome}`] ?? 0) + 1;
    check(step, action, delegateStart);
  }
  for (const o of OWNERS) exitAll(o, "the end");
  // a venue that deposited as itself, where a vault let it, takes its idle out too
  const venueIdle = idleOf(`${dep}.${RV}`, "mock-token");
  if (venueIdle > 0) expect(simnet.callPublicFn(RV, "take", [Cl.uint(venueIdle)], dep).result).toBeOk(Cl.bool(true));
  check(steps + 1, "everyone exits", delegateStart);
  for (const t of TOKENS) expect(walletOf(VAULT, t)).toBe(0);
  for (const v of VENUES) expect(vaultShares(v)).toBe(0);
  const { attempts, refusals } = tally();
  counts["call-backs attempted"] = attempts;
  counts["call-backs refused"] = refusals;
  return counts;
}

const summary = (c: Record<string, number>) => Object.entries(c).sort().map(([k, v]) => `${k} ${v}`).join(", ");

// A walk takes about 4 s locally, and more on CI's runners. Over 60 random seeds,
// successful allocations ranged from 10 to 41, unwinds and exits from 21 up, and
// call backs from 3 to 12. Every call back runs while the vault is closed, so every
// one must be refused. The fixed seed must reach 15 allocations, 15 unwinds and
// exits and 5 call backs; a random seed 5, 15 and 1.
const TIMEOUT = 60_000;
describe("v5 invariants over random sequences", () => {
  const exercised = (c: Record<string, number>, minAllocations: number, minCallBacks: number) => {
    expect(c["allocate ok"] ?? 0, "successful allocations").toBeGreaterThanOrEqual(minAllocations);
    expect((c["unwind ok"] ?? 0) + (c["owner-unwind ok"] ?? 0) + (c["exit done"] ?? 0), "unwinds and exits").toBeGreaterThanOrEqual(15);
    expect(c["call-backs attempted"], "call-backs attempted").toBeGreaterThanOrEqual(minCallBacks);
    expect(c["call-backs refused"], "call-backs refused").toBe(c["call-backs attempted"]);
  };
  it("invariants: 400 random steps across two owners and two delegates, fixed seed", () => {
    const counts = walk(20261014, 400);
    console.log("  seed 20261014           :", summary(counts));
    exercised(counts, 15, 5);
  }, TIMEOUT);
  it("invariants: 400 random steps, from a random seed printed for replay", () => {
    const seed = Number(process.env.INVARIANT_SEED ?? Math.floor(Math.random() * 2 ** 31));
    console.log(`  random seed ${seed} (replay with INVARIANT_SEED=${seed})`);
    const counts = walk(seed, 400);
    console.log("  seed", seed, "          :", summary(counts));
    exercised(counts, 5, 1);
  }, TIMEOUT);
});
