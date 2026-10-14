import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// #48: a venue runs code the vault doesn't control, and Clarity lets that code call
// back into the vault. In v4 a venue paying out an unwind can deposit its own
// tokens into the vault, as itself: the deposit credits the venue, and the unwind
// counts the same tokens as the payout and credits the owner too. v5 closes the
// vault while allocate, unwind or owner-unwind runs.
const a = simnet.getAccounts();
const dep = simnet.deployer;
const alice = a.get("wallet_1")!, mallory = a.get("wallet_2")!;
const MOCK = `${dep}.mock-token`;

const pp = (r: any) => Cl.prettyPrint(r);
const mock = () => Cl.contractPrincipal(dep, "mock-token");
const tokenOf = (who: string) => pp(simnet.callReadOnlyFn("mock-token", "get-balance", [Cl.principal(who)], dep).result);
const HOOK = { redeem: 2, read: 3 }, DEPOSIT = 1;

// alice holds 500,000 idle. mallory holds 1 in a venue she wrote, which keeps 499,999
// of its own, has listed mock-token in the vault for itself, and is armed to deposit
// all of it at `hook` during her next unwind
function scene(v: "v4" | "v5", hook: number, strict = true) {
  const V = `mandate-vault-${v}`, RV = v === "v4" ? "reentrant-venue-v4" : "reentrant-venue";
  const VAULT = `${dep}.${V}`, VENUE = `${dep}.${RV}`;
  const call = (fn: string, args: any[], who: string) => simnet.callPublicFn(V, fn, args, who);
  const idle = (who: string) => pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(who), Cl.principal(MOCK)], dep).result);
  const pos = (who: string) => pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(who), Cl.principal(VENUE)], dep).result);
  call("set-cap", [Cl.principal(MOCK), Cl.uint(1_000_000)], dep);
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(500_000), Cl.principal(alice)], dep);
  call("allow-asset", [Cl.principal(MOCK)], alice);
  expect(call("deposit", [mock(), Cl.uint(500_000)], alice).result).toBeOk(Cl.bool(true));
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(1), Cl.principal(mallory)], dep);
  call("allow-asset", [Cl.principal(MOCK)], mallory);
  call("allow-venue", [Cl.principal(VENUE), Cl.principal(MOCK)], mallory);
  expect(call("deposit", [mock(), Cl.uint(1)], mallory).result).toBeOk(Cl.bool(true));
  expect(call("grant", [Cl.principal(mallory), Cl.uint(1_000_000), Cl.uint(9_999_999), Cl.uint(100), Cl.uint(100),
    Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000)], mallory).result).toBeOk(Cl.bool(true));
  expect(call("allocate", [Cl.principal(mallory), Cl.contractPrincipal(dep, RV), mock(), Cl.uint(1)], mallory).result).toBeOk(Cl.uint(1));
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(499_999), Cl.principal(VENUE)], dep);
  expect(simnet.callPublicFn(RV, "setup", [], mallory).result).toBeOk(Cl.bool(true));
  simnet.callPublicFn(RV, "arm", [Cl.uint(hook), Cl.uint(DEPOSIT), Cl.uint(499_999), Cl.principal(mallory), Cl.bool(strict)], mallory);
  const books = () => ({ alice: idle(alice), mallory: idle(mallory), venue: idle(VENUE), position: pos(mallory), vault: tokenOf(VAULT) });
  const ownerUnwind = () => call("owner-unwind", [Cl.contractPrincipal(dep, RV), mock(), Cl.uint(1), Cl.uint(0)], mallory);
  const unwind = () => call("unwind", [Cl.principal(mallory), Cl.contractPrincipal(dep, RV), mock(), Cl.uint(1)], mallory);
  const drain = () => ({
    mallory: pp(call("withdraw", [mock(), Cl.uint(500_000)], mallory).result),
    venue: pp(simnet.callPublicFn(RV, "take", [Cl.uint(499_999)], mallory).result),
    alice: pp(call("withdraw", [mock(), Cl.uint(500_000)], alice).result),
  });
  return { books, ownerUnwind, unwind, drain, RV, VAULT };
}

// v4: the unwind is credited twice, and alice's deposit is gone
function creditedTwice(s: ReturnType<typeof scene>, r: any, label: string) {
  const after = s.books(); const out = s.drain();
  console.log(`  v4, ${label.padEnd(26)}:`, pp(r.result), "| books", JSON.stringify(after), "| withdrawals", JSON.stringify(out),
    "| vault holds", tokenOf(s.VAULT));
  expect(r.result).toBeOk(Cl.uint(500_000));                   // 1 paid back, plus the venue's own 499,999
  expect(after).toEqual({ alice: "u500000", mallory: "u500000", venue: "u499999", position: "u0", vault: "(ok u1000000)" });
  expect(out).toEqual({ mallory: "(ok true)", venue: "(ok true)", alice: "(err u1)" }); // the vault holds 1
}

// v5: refused, and nothing moved. A refusal the venue passes on from its balance
// read reaches the caller as the vault's own failed-read code, u109
function refused(s: ReturnType<typeof scene>, attack: () => any, label: string, code = 120) {
  const before = s.books(); const r = attack();
  console.log(`  v5, ${label.padEnd(26)}:`, pp(r.result), "| books", JSON.stringify(s.books()));
  expect(r.result).toBeErr(Cl.uint(code));
  expect(r.events.filter((e: any) => /^(ft|nft|stx)_/.test(e.event))).toEqual([]);
  expect(s.books()).toEqual(before);
}

// v5, with a venue that swallows the refusal: the unwind completes, and the venue's
// own tally records the call back the vault refused
function ignored(hook: number, where: string) {
  const s = scene("v5", hook, false);
  const r = s.ownerUnwind();
  const tally = pp(simnet.callReadOnlyFn(s.RV, "tally", [], dep).result);
  console.log(`  v5, ignored at ${where.padEnd(13)}:`, pp(r.result), "| books", JSON.stringify(s.books()), "| venue's tally", tally);
  expect(r.result).toBeOk(Cl.uint(1));
  expect(tally).toBe("{ attempts: u1, refusals: u1 }");
  expect(s.books()).toEqual({ alice: "u500000", mallory: "u1", venue: "u0", position: "u0", vault: "(ok u500001)" });
}

describe("a venue that calls back into the vault (#48)", () => {
  it("v4: a venue that deposits while paying out the owner's unwind is credited twice, and another owner can't withdraw", () => {
    const s = scene("v4", HOOK.redeem); creditedTwice(s, s.ownerUnwind(), "the owner's unwind");
  });
  it("v4: the same through the delegate's unwind", () => {
    const s = scene("v4", HOOK.redeem); creditedTwice(s, s.unwind(), "the delegate's unwind");
  });
  it("v4: the same from a public balance read after the redeem", () => {
    const s = scene("v4", HOOK.read); creditedTwice(s, s.ownerUnwind(), "the balance read");
  });
  it("v5: a deposit while paying out the owner's unwind is refused, and nothing moves", () => {
    const s = scene("v5", HOOK.redeem); refused(s, s.ownerUnwind, "the owner's unwind");
  });
  it("v5: the same through the delegate's unwind is refused, and nothing moves", () => {
    const s = scene("v5", HOOK.redeem); refused(s, s.unwind, "the delegate's unwind");
  });
  it("v5: the same from a public balance read fails, and nothing moves", () => {
    const s = scene("v5", HOOK.read); refused(s, s.ownerUnwind, "the balance read", 109);
  });
  it("v5: a venue that ignores the refusal in its redeem carries on honestly, and the books still match", () => {
    ignored(HOOK.redeem, "redeem");
  });
  it("v5: a venue that ignores the refusal at its balance read carries on honestly, and the books still match", () => {
    ignored(HOOK.read, "balance read");
  });
  it("v5: a refused call leaves the vault open for the next call in the same transaction", () => {
    const V = "mandate-vault-v5", SELF = `${dep}.self-owner`;
    simnet.callPublicFn(V, "set-cap", [Cl.principal(MOCK), Cl.uint(1_000_000)], dep);
    simnet.callPublicFn("mock-token", "mint", [Cl.uint(50_000), Cl.principal(SELF)], dep);
    const r = simnet.callPublicFn("self-owner", "refused-then-deposit", [Cl.uint(50_000)], alice);
    const held = pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(SELF), Cl.principal(MOCK)], dep).result);
    console.log("  v5, refused then deposit  :", pp(r.result), "| idle", held);
    expect(r.result).toBeOk(Cl.bool(true));
    expect(held).toBe("u50000");
  });
});
