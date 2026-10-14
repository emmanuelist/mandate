import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// The adversarial suite (#30): a delegate, and the people around it, attempting
// every attack the mandate exists to stop. Each case asserts the exact refusal,
// that the call emitted no asset events, and that no balance anywhere changed.
const a = simnet.getAccounts();
const dep = simnet.deployer;
const alice = a.get("wallet_1")!, bob = a.get("wallet_2")!;
const agentX = a.get("wallet_3")!;
const V = "mandate-vault-v4";
const VAULT = `${dep}.${V}`;
const MOCK = `${dep}.mock-token`;
const VENUE = `${dep}.mock-venue`;
const HOSTILE = `${dep}.hostile-venue`;
const PHISH = `${dep}.phish-venue`;
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";

const pp = (r: any) => Cl.prettyPrint(r);
const mock = () => Cl.contractPrincipal(dep, "mock-token");
const sbtc = () => Cl.contractPrincipal("SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4", "sbtc-token");
const venue = (name = "mock-venue") => Cl.contractPrincipal(dep, name);
const ro = (fn: string, args: any[]) => pp(simnet.callReadOnlyFn(V, fn, args, dep).result);
const tokenOf = (who: string) => pp(simnet.callReadOnlyFn("mock-token", "get-balance", [Cl.principal(who)], dep).result);

// every balance an attack could move
const snapshot = () => ({
  vault: tokenOf(VAULT), venue: tokenOf(VENUE), hostile: tokenOf(HOSTILE), phish: tokenOf(PHISH),
  agent: tokenOf(agentX), aliceWallet: tokenOf(alice), bobWallet: tokenOf(bob),
  aliceIdle: ro("balance-of", [Cl.principal(alice), Cl.principal(MOCK)]),
  bobIdle: ro("balance-of", [Cl.principal(bob), Cl.principal(MOCK)]),
  agentIdle: ro("balance-of", [Cl.principal(agentX), Cl.principal(MOCK)]),
  alicePos: ro("shares-of", [Cl.principal(alice), Cl.principal(VENUE)]),
  bobPos: ro("shares-of", [Cl.principal(bob), Cl.principal(VENUE)]),
  vaultShares: pp(simnet.callReadOnlyFn("mock-venue", "get-balance", [Cl.principal(VAULT)], dep).result),
});

function refused(code: number, attack: () => { result: any; events: any[] }) {
  const before = snapshot();
  const r = attack();
  expect(r.result).toBeErr(Cl.uint(code));
  expect(r.events.filter((e: any) => /^(ft|nft|stx)_/.test(e.event))).toEqual([]);
  expect(snapshot()).toEqual(before);
}

type Limits = Partial<{ cap: number; expires: number; trades: number; daily: number }>;
const grant = (owner: string, agent: string, l: Limits = {}) =>
  simnet.callPublicFn(V, "grant", [
    Cl.principal(agent), Cl.uint(l.cap ?? 100_000), Cl.uint(l.expires ?? simnet.burnBlockHeight + 1_000),
    Cl.uint(100), Cl.uint(l.trades ?? 3), Cl.uint(144), Cl.uint(l.daily ?? 250_000), Cl.uint(10_000),
  ], owner);
const allocate = (owner: string, amount: number | bigint, by = agentX, v = venue(), asset = mock()) =>
  simnet.callPublicFn(V, "allocate", [Cl.principal(owner), v, asset, Cl.uint(amount)], by);
const unwind = (owner: string, shares: number, by = agentX, v = venue(), asset = mock()) =>
  simnet.callPublicFn(V, "unwind", [Cl.principal(owner), v, asset, Cl.uint(shares)], by);
const call = (fn: string, args: any[], by: string) => simnet.callPublicFn(V, fn, args, by);

// alice: 400,000 idle and a mandate for agentX; bob: 300,000 idle and no mandate
function world() {
  simnet.callPublicFn(V, "set-cap", [Cl.principal(MOCK), Cl.uint(10_000_000)], dep);
  for (const [who, amount] of [[alice, 400_000], [bob, 300_000]] as const) {
    simnet.callPublicFn("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(who)], dep);
    call("allow-asset", [Cl.principal(MOCK)], who);
    call("allow-venue", [Cl.principal(VENUE), Cl.principal(MOCK)], who);
    expect(call("deposit", [mock(), Cl.uint(amount)], who).result).toBeOk(Cl.bool(true));
  }
  expect(grant(alice, agentX).result).toBeOk(Cl.bool(true));
}
const expireMandate = () => {
  const expires = simnet.burnBlockHeight + 3;
  grant(alice, agentX, { expires });
  return () => { while (simnet.burnBlockHeight < expires) simnet.mineEmptyBurnBlock(); };
};

describe("adversarial: oversized orders", () => {
  it("oversized: one sat over the per-move cap", () => { world(); refused(102, () => allocate(alice, 100_001)); });
  it("oversized: ten times the per-move cap", () => { world(); refused(102, () => allocate(alice, 1_000_000)); });
  it("oversized: the largest possible amount", () => {
    world(); refused(102, () => allocate(alice, 340282366920938463463374607431768211455n));
  });
  it("oversized: the whole idle balance in one move", () => { world(); refused(102, () => allocate(alice, 400_000)); });
  it("oversized: a move inside the per-move cap that passes the day's total", () => {
    world();
    expect(allocate(alice, 100_000).result).toBeOk(Cl.uint(100_000));
    expect(allocate(alice, 100_000).result).toBeOk(Cl.uint(100_000));
    refused(111, () => allocate(alice, 100_000));
  });
  it("oversized: a move larger than the owner's idle balance", () => {
    world(); grant(alice, agentX, { cap: 1_000_000, daily: 10_000_000 });
    refused(105, () => allocate(alice, 500_000));
  });
  it("oversized: a zero move, which would only spend the rate window", () => { world(); refused(109, () => allocate(alice, 0)); });
  it("oversized: unwinding one share more than the position", () => {
    world(); allocate(alice, 50_000);
    refused(113, () => unwind(alice, 50_001));
  });
});

describe("adversarial: unlisted assets", () => {
  it("unlisted asset: an asset the owner never allowlisted", () => {
    world(); refused(106, () => allocate(alice, 10_000, agentX, venue(), sbtc()));
  });
  it("unlisted asset: an asset the owner disallowed after granting", () => {
    world(); call("disallow-asset", [Cl.principal(MOCK)], alice);
    refused(106, () => allocate(alice, 10_000));
  });
  it("unlisted asset: an asset only another owner allowlisted", () => {
    world(); call("allow-asset", [Cl.principal(SBTC)], bob);
    refused(106, () => allocate(alice, 10_000, agentX, venue(), sbtc()));
  });
  it("unlisted asset: an asset the delegate allowlisted for itself", () => {
    world(); call("allow-asset", [Cl.principal(SBTC)], agentX);
    refused(106, () => allocate(alice, 10_000, agentX, venue(), sbtc()));
  });
  it("unlisted asset: a listed venue paired with an asset it wasn't listed for", () => {
    world(); call("allow-asset", [Cl.principal(SBTC)], alice);
    refused(107, () => allocate(alice, 10_000, agentX, venue(), sbtc()));
  });
  it("unlisted asset: unwinding into an asset other than the position's", () => {
    world(); allocate(alice, 50_000);
    refused(106, () => unwind(alice, 50_000, agentX, venue(), sbtc()));
  });
});

describe("adversarial: substituted venues", () => {
  it("substituted venue: a venue the owner never listed", () => {
    world(); refused(107, () => allocate(alice, 10_000, agentX, venue("hostile-venue")));
  });
  it("substituted venue: a venue only another owner listed", () => {
    world(); call("allow-venue", [Cl.principal(HOSTILE), Cl.principal(MOCK)], bob);
    refused(107, () => allocate(alice, 10_000, agentX, venue("hostile-venue")));
  });
  it("substituted venue: a venue the delegate listed for itself", () => {
    world(); call("allow-venue", [Cl.principal(HOSTILE), Cl.principal(MOCK)], agentX);
    refused(107, () => allocate(alice, 10_000, agentX, venue("hostile-venue")));
  });
  it("substituted venue: a venue the owner disallowed", () => {
    world(); call("disallow-venue", [Cl.principal(VENUE)], alice);
    refused(107, () => allocate(alice, 10_000));
  });
  it("substituted venue: a venue built to keep what it is given", () => {
    world(); refused(107, () => allocate(alice, 10_000, agentX, venue("phish-venue")));
  });
  it("substituted venue: unwinding from a venue that holds no position", () => {
    world(); allocate(alice, 50_000);
    refused(113, () => unwind(alice, 50_000, agentX, venue("hostile-venue")));
  });
  it("substituted venue: the delegate calls the owner's own exit", () => {
    world(); allocate(alice, 50_000);
    refused(113, () => call("owner-unwind", [venue(), mock(), Cl.uint(50_000), Cl.uint(1)], agentX));
  });
});

describe("adversarial: rate-limit races", () => {
  it("rate race: one move more than the window allows", () => {
    world(); for (let i = 0; i < 3; i++) expect(allocate(alice, 10_000).result).toBeOk(Cl.uint(10_000));
    refused(110, () => allocate(alice, 10_000));
  });
  it("rate race: alternating allocations and unwinds past the window", () => {
    world();
    expect(allocate(alice, 10_000).result).toBeOk(Cl.uint(10_000));
    expect(unwind(alice, 10_000).result).toBeOk(Cl.uint(10_000));
    expect(allocate(alice, 10_000).result).toBeOk(Cl.uint(10_000));
    refused(110, () => unwind(alice, 10_000));
  });
  it("rate race: dust moves to burn through the window", () => {
    world(); for (let i = 0; i < 3; i++) expect(allocate(alice, 1).result).toBeOk(Cl.uint(1));
    refused(110, () => allocate(alice, 1));
  });
  it("rate race: the delegate re-grants itself to reset its counters", () => {
    world(); for (let i = 0; i < 3; i++) allocate(alice, 10_000);
    expect(grant(agentX, agentX).result).toBeOk(Cl.bool(true));   // only its own books
    refused(110, () => allocate(alice, 10_000));
  });
  it("rate race: waiting most of the window doesn't reset it", () => {
    world(); for (let i = 0; i < 3; i++) allocate(alice, 10_000);
    simnet.mineEmptyBurnBlocks(100);
    refused(110, () => allocate(alice, 10_000));
  });
  it("rate race: waiting most of the day doesn't reset the day's total", () => {
    world(); allocate(alice, 100_000); allocate(alice, 100_000);
    simnet.mineEmptyBurnBlocks(100);
    refused(111, () => allocate(alice, 100_000));
  });
});

describe("adversarial: expiry and revocation", () => {
  it("expiry: a move at the expiry height", () => {
    world(); const reach = expireMandate(); reach();
    refused(103, () => allocate(alice, 10_000));
  });
  it("expiry: a move after expiry", () => {
    world(); const reach = expireMandate(); reach(); simnet.mineEmptyBurnBlocks(10);
    refused(103, () => allocate(alice, 10_000));
  });
  it("expiry: an unwind after expiry", () => {
    world(); const reach = expireMandate();
    expect(allocate(alice, 50_000).result).toBeOk(Cl.uint(50_000));
    reach();
    refused(103, () => unwind(alice, 50_000));
  });
  it("expiry: the delegate grants itself a fresh mandate after expiry", () => {
    world(); const reach = expireMandate(); reach();
    expect(grant(agentX, agentX).result).toBeOk(Cl.bool(true));   // only its own books
    refused(103, () => allocate(alice, 10_000));
  });
  it("revocation: a move after the owner revokes", () => {
    world(); call("revoke", [Cl.principal(agentX)], alice);
    refused(100, () => allocate(alice, 10_000));
  });
  it("revocation: an unwind after the owner revokes", () => {
    world(); allocate(alice, 50_000); call("revoke", [Cl.principal(agentX)], alice);
    refused(100, () => unwind(alice, 50_000));
  });
});

describe("adversarial: reaching another owner's balance", () => {
  it("another owner: a stranger with no mandate moves an owner's balance", () => {
    world(); refused(100, () => allocate(alice, 10_000, dep));
  });
  it("another owner: one owner's mandate doesn't reach another owner's balance", () => {
    world(); refused(100, () => allocate(bob, 10_000));
  });
  it("another owner: the other owner's mandate doesn't reach this one", () => {
    world(); call("revoke", [Cl.principal(agentX)], alice); grant(bob, agentX);
    refused(100, () => allocate(alice, 10_000));
  });
  it("another owner: unwinding another owner's shares at the same venue", () => {
    world(); grant(bob, agentX);
    allocate(alice, 50_000); allocate(bob, 50_000);
    refused(113, () => unwind(alice, 100_000));
  });
  it("another owner: an owner withdraws past their own balance while the vault holds others'", () => {
    world(); refused(105, () => call("withdraw", [mock(), Cl.uint(300_001)], bob));
  });
  it("another owner: an owner unwinds another owner's position", () => {
    world(); allocate(alice, 50_000);
    refused(113, () => call("owner-unwind", [venue(), mock(), Cl.uint(50_000), Cl.uint(1)], bob));
  });
  it("another owner: the vault named as the owner", () => {
    world(); refused(100, () => allocate(VAULT, 10_000));
  });
});

describe("adversarial: withdrawing outright", () => {
  it("withdrawing: the delegate calls withdraw", () => {
    world(); refused(105, () => call("withdraw", [mock(), Cl.uint(1)], agentX));
  });
  it("withdrawing: the delegate pulls the vault's tokens through the token contract", () => {
    world();
    refused(4, () => simnet.callPublicFn("mock-token", "transfer",
      [Cl.uint(1), Cl.principal(VAULT), Cl.principal(agentX), Cl.none()], agentX));
  });
  it("withdrawing: the delegate withdraws what it just unwound", () => {
    world(); allocate(alice, 50_000); unwind(alice, 50_000);
    refused(105, () => call("withdraw", [mock(), Cl.uint(50_000)], agentX));
  });
});
