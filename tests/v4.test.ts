import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// v4 against a deterministic venue (contracts/mock-venue.clar). The real-Zest
// path is the fork test for #5; the call pattern itself is proven in
// tests/venue-spike.test.ts.
const a = simnet.getAccounts();
const dep = simnet.deployer;
const alice = a.get("wallet_1")!, bob = a.get("wallet_2")!;
const agentX = a.get("wallet_3")!;
const mallory = bob; // the stranger, wallet_2 as in the v2 tests; no test needs both
const V = "mandate-vault-v4";
const MOCK = `${dep}.mock-token`;
const VENUE = `${dep}.mock-venue`;
const VAULT = `${dep}.${V}`;
const CAP = 10_000_000; // the tests' cap on the vault's mock-token principal

const mock = () => Cl.contractPrincipal(dep, "mock-token");
const venue = () => Cl.contractPrincipal(dep, "mock-venue");
const sbtc = () => Cl.contractPrincipal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token");

const pp = (r: any) => Cl.prettyPrint(r);
const ro = (fn: string, args: any[]) => pp(simnet.callReadOnlyFn(V, fn, args, dep).result);
const bal = (who: string) => ro("balance-of", [Cl.principal(who), Cl.principal(MOCK)]);
const pos = (who: string) => ro("shares-of", [Cl.principal(who), Cl.principal(VENUE)]);
const tokenOf = (who: string) =>
  pp(simnet.callReadOnlyFn("mock-token", "get-balance", [Cl.principal(who)], dep).result);
const vaultShares = () =>
  pp(simnet.callReadOnlyFn("mock-venue", "get-balance", [Cl.principal(VAULT)], dep).result);

function setup(owner = alice, amount = 400_000) {
  simnet.callPublicFn(V, "set-cap", [Cl.principal(MOCK), Cl.uint(CAP)], dep); // refused after the first, harmlessly
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(owner)], dep);
  simnet.callPublicFn(V, "allow-asset", [Cl.principal(MOCK)], owner);
  simnet.callPublicFn(V, "allow-venue", [Cl.principal(VENUE), Cl.principal(MOCK)], owner);
  if (amount > 0) simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(amount)], owner);
}

// (agent, maxNotional, expires, slipBps, tradesPerWindow, windowLen, dailyNotional, cumSlipBps)
const grant = (o: string, ag: string,
  opts: Partial<{ cap: number; expires: number; slip: number; trades: number; daily: number; cum: number }> = {}) =>
  simnet.callPublicFn(V, "grant", [
    Cl.principal(ag), Cl.uint(opts.cap ?? 500_000), Cl.uint(opts.expires ?? 9_999_999),
    Cl.uint(opts.slip ?? 100), Cl.uint(opts.trades ?? 100), Cl.uint(144),
    Cl.uint(opts.daily ?? 10_000_000), Cl.uint(opts.cum ?? 10_000),
  ], o);

const allocate = (owner: string, amount: number, by = agentX, asset = mock()) =>
  simnet.callPublicFn(V, "allocate", [Cl.principal(owner), venue(), asset, Cl.uint(amount)], by);
const unwind = (owner: string, shares: number, by = agentX) =>
  simnet.callPublicFn(V, "unwind", [Cl.principal(owner), venue(), mock(), Cl.uint(shares)], by);
const ownerUnwind = (owner: string, shares: number, minOut = 1) =>
  simnet.callPublicFn(V, "owner-unwind", [venue(), mock(), Cl.uint(shares), Cl.uint(minOut)], owner);

describe("v4: the delegate allocates through a venue", () => {
  it("allocates idle assets into the venue, unwinds them, and the owner withdraws everything", () => {
    setup();
    grant(alice, agentX);
    const al = allocate(alice, 100_000);
    console.log("  allocate 100k            :", pp(al.result), "| idle", bal(alice), "| position", pos(alice), "| vault shares", vaultShares());
    expect(al.result).toBeOk(Cl.uint(100_000));
    expect(bal(alice)).toBe("u300000");
    expect(pos(alice)).toBe("u100000");
    expect(vaultShares()).toBe("(ok u100000)");

    const un = unwind(alice, 40_000);
    console.log("  unwind 40k               :", pp(un.result), "| idle", bal(alice), "| position", pos(alice));
    expect(un.result).toBeOk(Cl.uint(40_000));
    expect(bal(alice)).toBe("u340000");
    expect(pos(alice)).toBe("u60000");

    const ou = ownerUnwind(alice, 60_000);
    expect(ou.result).toBeOk(Cl.uint(60_000));
    expect(pos(alice)).toBe("u0");
    expect(ro("position-of", [Cl.principal(alice), Cl.principal(VENUE)])).toBe("none");

    const wd = simnet.callPublicFn(V, "withdraw", [mock(), Cl.uint(400_000)], alice);
    console.log("  owner withdraws 400k     :", pp(wd.result), "| wallet", tokenOf(alice));
    expect(wd.result).toBeOk(Cl.bool(true));
    expect(tokenOf(alice)).toBe("(ok u1000000)");
    expect(vaultShares()).toBe("(ok u0)");
  });
});

describe("v4 policy: every v2 limit applies to allocate", () => {
  it("refuses a caller with no mandate", () => {
    setup();
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(100));      // ERR_NO_MANDATE
  });
  it("refuses a move above the per-move cap", () => {
    setup(); grant(alice, agentX, { cap: 1_000 });
    expect(allocate(alice, 1_001).result).toBeErr(Cl.uint(102));      // ERR_TOO_LARGE
  });
  it("refuses once the mandate has expired", () => {
    setup(); grant(alice, agentX, { expires: 1 });
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(103));      // ERR_EXPIRED
  });
  it("refuses an asset the owner hasn't allowlisted", () => {
    setup(); grant(alice, agentX);
    expect(allocate(alice, 1_000, agentX, sbtc()).result).toBeErr(Cl.uint(106));  // ERR_ASSET
  });
  it("refuses a venue the owner hasn't allowlisted", () => {
    setup(); grant(alice, agentX);
    simnet.callPublicFn(V, "disallow-venue", [Cl.principal(VENUE)], alice);
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(107));      // ERR_VENUE
  });
  it("refuses a venue allowlisted for a different asset", () => {
    setup(); grant(alice, agentX);
    simnet.callPublicFn(V, "allow-venue", [Cl.principal(VENUE), Cl.principal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token")], alice);
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(107));      // ERR_VENUE
  });
  it("refuses when the rate window is exhausted", () => {
    setup(); grant(alice, agentX, { trades: 0 });
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(110));      // ERR_RATE
  });
  it("refuses a move that would exceed the day's notional", () => {
    setup(); grant(alice, agentX, { daily: 500 });
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(111));      // ERR_DAILY
  });
  it("refuses a move larger than the owner's idle balance", () => {
    setup(alice, 500); grant(alice, agentX);
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(105));      // ERR_BALANCE
  });
  it("answers policy before state: the rate limit beats an empty balance", () => {
    setup(alice, 0); grant(alice, agentX, { trades: 0 });
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(110));      // ERR_RATE, not ERR_BALANCE
  });
});

describe("v4 slippage: the floor comes from the venue's quote, not the delegate", () => {
  it("refuses a fill worse than the mandate's slippage, and nothing moves", () => {
    setup(); grant(alice, agentX, { slip: 100 });
    simnet.callPublicFn("mock-venue", "set-haircut", [Cl.uint(200)], dep);   // 2% worse than quoted
    const r = allocate(alice, 100_000);
    console.log("  2% fill vs 1% limit      :", pp(r.result), "| idle", bal(alice));
    expect(r.result).toBeErr(Cl.uint(201));                           // the venue enforces our floor
    expect(bal(alice)).toBe("u400000");
    expect(pos(alice)).toBe("u0");
  });
  it("stops repeated small bleeds with the cumulative budget", () => {
    setup(); grant(alice, agentX, { slip: 100, cum: 100 });
    simnet.callPublicFn("mock-venue", "set-haircut", [Cl.uint(60)], dep);    // 0.6% each, inside 1%
    const first = allocate(alice, 10_000), second = allocate(alice, 10_000);
    console.log("  0.6% then 0.6% vs 1% cum :", pp(first.result), pp(second.result));
    expect(first.result).toBeOk(Cl.uint(9_940));
    expect(second.result).toBeErr(Cl.uint(112));                      // ERR_LOSS_BUDGET
  });
});

describe("v4 keeps v2's fixes, ported to the new entry points", () => {
  it("revoking can't strand funds: the owner unwinds and withdraws without a mandate", () => {
    setup(); grant(alice, agentX);
    allocate(alice, 100_000);
    simnet.callPublicFn(V, "revoke", [Cl.principal(agentX)], alice);
    const agentTry = unwind(alice, 100_000);
    const own = ownerUnwind(alice, 100_000);
    const wd = simnet.callPublicFn(V, "withdraw", [mock(), Cl.uint(400_000)], alice);
    console.log("  after revoke: agent unwind", pp(agentTry.result), "| owner unwind", pp(own.result), "| withdraw", pp(wd.result));
    expect(agentTry.result).toBeErr(Cl.uint(100));
    expect(own.result).toBeOk(Cl.uint(100_000));
    expect(wd.result).toBeOk(Cl.bool(true));
  });
  it("expiry can't strand funds either", () => {
    setup(); grant(alice, agentX);
    allocate(alice, 50_000);
    grant(alice, agentX, { expires: 1 });
    expect(unwind(alice, 50_000).result).toBeErr(Cl.uint(103));
    expect(ownerUnwind(alice, 50_000).result).toBeOk(Cl.uint(50_000));
  });
  it("a stranger can't redirect another owner's delegate", () => {
    setup(); grant(alice, agentX, { cap: 1_000 });
    grant(mallory, agentX, { cap: 50_000_000 });
    const r = allocate(alice, 300_000);
    console.log("  agentX moving 300k of alice (cap 1k):", pp(r.result));
    expect(r.result).toBeErr(Cl.uint(102));
  });
  it("one owner can't withdraw another owner's deposit", () => {
    setup();
    expect(simnet.callPublicFn(V, "withdraw", [mock(), Cl.uint(400_000)], bob).result).toBeErr(Cl.uint(105));
  });
  it("allowlists are per owner: mallory's entries don't reach alice's mandate", () => {
    simnet.callPublicFn("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(alice)], dep);
    simnet.callPublicFn(V, "allow-asset", [Cl.principal(MOCK)], mallory);
    simnet.callPublicFn(V, "allow-venue", [Cl.principal(VENUE), Cl.principal(MOCK)], mallory);
    grant(alice, agentX);
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(106));
  });
  it("the delegate can't withdraw", () => {
    setup(); grant(alice, agentX);
    expect(simnet.callPublicFn(V, "withdraw", [mock(), Cl.uint(1)], agentX).result).toBeErr(Cl.uint(105));
  });
});

describe("v4 grant parameters", () => {
  const raw = (win: number, slip: number, cum: number) =>
    simnet.callPublicFn(V, "grant", [Cl.principal(agentX), Cl.uint(500_000), Cl.uint(9_999_999),
      Cl.uint(slip), Cl.uint(100), Cl.uint(win), Cl.uint(10_000_000), Cl.uint(cum)], alice);
  it("grant refuses a zero-length rate window, which would switch the rate limit off", () => {
    expect(raw(0, 100, 10_000).result).toBeErr(Cl.uint(116));        // ERR_PARAMS
  });
  it("grant refuses per-move slippage above 100%", () => {
    expect(raw(144, 10_001, 10_000).result).toBeErr(Cl.uint(116));
  });
  it("grant refuses a slippage budget above 100%", () => {
    expect(raw(144, 100, 10_001).result).toBeErr(Cl.uint(116));
  });
  it("grant accepts the boundaries: a one-block window and 100% slippage", () => {
    expect(raw(1, 10_000, 10_000).result).toBeOk(Cl.bool(true));
  });
  it("a refused grant leaves the existing mandate in force", () => {
    setup(); grant(alice, agentX, { cap: 1_000 });
    expect(raw(0, 100, 10_000).result).toBeErr(Cl.uint(116));
    expect(allocate(alice, 1_000).result).toBeOk(Cl.uint(1_000));    // the old cap still applies
    expect(allocate(alice, 1_001).result).toBeErr(Cl.uint(102));
  });
});

describe("v4 positions", () => {
  it("a position keeps the asset it was opened with", () => {
    setup(); grant(alice, agentX);
    allocate(alice, 10_000);
    simnet.callPublicFn(V, "allow-asset", [Cl.principal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token")], alice);
    simnet.callPublicFn(V, "allow-venue", [Cl.principal(VENUE), Cl.principal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token")], alice);
    expect(allocate(alice, 1_000, agentX, sbtc()).result).toBeErr(Cl.uint(107));
  });
  it("disallowing a venue stops new allocations but not unwinding", () => {
    setup(); grant(alice, agentX);
    allocate(alice, 10_000);
    simnet.callPublicFn(V, "disallow-venue", [Cl.principal(VENUE)], alice);
    expect(allocate(alice, 1_000).result).toBeErr(Cl.uint(107));
    expect(unwind(alice, 10_000).result).toBeOk(Cl.uint(10_000));
  });
  it("the delegate can't unwind more than the position", () => {
    setup(); grant(alice, agentX);
    allocate(alice, 10_000);
    expect(unwind(alice, 10_001).result).toBeErr(Cl.uint(113));      // ERR_POSITION
  });
  it("unwinding with an asset other than the position's is refused", () => {
    setup(); grant(alice, agentX);
    allocate(alice, 10_000);
    const r = simnet.callPublicFn(V, "unwind", [Cl.principal(alice), venue(), sbtc(), Cl.uint(10_000)], agentX);
    expect(r.result).toBeErr(Cl.uint(106));                            // ERR_ASSET
  });
  it("the owner can't unwind another owner's position", () => {
    setup(); grant(alice, agentX);
    allocate(alice, 10_000);
    expect(ownerUnwind(bob, 10_000).result).toBeErr(Cl.uint(113));
  });
});

describe("v4: the per-vault AUM cap", () => {
  const capOf = () => ro("cap-of", [Cl.principal(MOCK)]);
  const aumOf = () => ro("aum-of", [Cl.principal(MOCK)]);
  const ready = (who: string) => {
    simnet.callPublicFn("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(who)], dep);
    simnet.callPublicFn(V, "allow-asset", [Cl.principal(MOCK)], who);
  };
  const deposit = (who: string, n: number) => simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(n)], who);
  const setCap = (cap: number, by = dep, token = MOCK) =>
    simnet.callPublicFn(V, "set-cap", [Cl.principal(token), Cl.uint(cap)], by);

  it("the cap: deposits up to it succeed across owners, and one sat over is refused with nothing moved", () => {
    expect(setCap(1_000_000).result).toBeOk(Cl.bool(true));
    ready(alice); ready(bob);
    expect(deposit(alice, 600_000).result).toBeOk(Cl.bool(true));
    expect(deposit(bob, 400_000).result).toBeOk(Cl.bool(true));
    const over = deposit(bob, 1);
    console.log("  at the cap, 1 sat more   :", pp(over.result), "| principal", aumOf(), "of cap", capOf(), "| vault", tokenOf(VAULT));
    expect(over.result).toBeErr(Cl.uint(117));
    expect(aumOf()).toBe("u1000000");
    expect(tokenOf(VAULT)).toBe("(ok u1000000)");
    expect(tokenOf(bob)).toBe("(ok u600000)");
    expect(bal(bob)).toBe("u400000");
  });

  it("the cap: a withdrawal frees room under it, and moving funds into a venue does not", () => {
    expect(setCap(1_000_000).result).toBeOk(Cl.bool(true));
    ready(alice);
    simnet.callPublicFn(V, "allow-venue", [Cl.principal(VENUE), Cl.principal(MOCK)], alice);
    expect(deposit(alice, 1_000_000).result).toBeOk(Cl.bool(true));
    grant(alice, agentX);
    expect(allocate(alice, 500_000).result).toBeOk(Cl.uint(500_000));
    expect(aumOf()).toBe("u1000000");                         // funds in a venue are still under management
    expect(deposit(alice, 1).result).toBeErr(Cl.uint(117));
    expect(unwind(alice, 500_000).result).toBeOk(Cl.uint(500_000));
    expect(aumOf()).toBe("u1000000");
    expect(simnet.callPublicFn(V, "withdraw", [mock(), Cl.uint(300_000)], alice).result).toBeOk(Cl.bool(true));
    console.log("  after withdrawing 300000 :", "principal", aumOf(), "of cap", capOf());
    expect(aumOf()).toBe("u700000");
    expect(deposit(alice, 300_000).result).toBeOk(Cl.bool(true));
    expect(aumOf()).toBe("u1000000");
  });

  it("the cap: an asset without a cap can't be deposited", () => {
    ready(alice);
    const r = deposit(alice, 1);
    console.log("  no cap set, deposit 1    :", pp(r.result), "| cap", capOf(), "| vault", tokenOf(VAULT));
    expect(r.result).toBeErr(Cl.uint(117));
    expect(tokenOf(VAULT)).toBe("(ok u0)");
    expect(tokenOf(alice)).toBe("(ok u1000000)");
  });

  it("the cap: only the deployer sets it, once, and it can be neither zero nor raised", () => {
    const stranger = setCap(1_000_000, mallory);
    const zero = setCap(0);
    const first = setCap(1_000_000);
    const raise = setCap(2_000_000);
    const other = setCap(5_000, dep, "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token");
    console.log("  stranger, zero, set, raise, other asset:", pp(stranger.result), pp(zero.result), pp(first.result),
      pp(raise.result), pp(other.result), "| cap", capOf());
    expect(stranger.result).toBeErr(Cl.uint(118));
    expect(zero.result).toBeErr(Cl.uint(116));
    expect(first.result).toBeOk(Cl.bool(true));
    expect(raise.result).toBeErr(Cl.uint(119));
    expect(other.result).toBeOk(Cl.bool(true));               // each asset has its own cap
    expect(capOf()).toBe("u1000000");
  });
});
