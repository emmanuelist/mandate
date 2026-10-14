import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// v4 against contracts/hostile-venue.clar, a venue that misbehaves on purpose.
// Each attack must be refused with nothing moved: idle balances, positions and
// the vault's real token balance all unchanged.
const a = simnet.getAccounts();
const dep = simnet.deployer;
const alice = a.get("wallet_1")!, bob = a.get("wallet_2")!, agentX = a.get("wallet_3")!;
const V = "mandate-vault-v4";
const MOCK = `${dep}.mock-token`;
const HOSTILE = `${dep}.hostile-venue`;
const VAULT = `${dep}.${V}`;

const pp = (r: any) => Cl.prettyPrint(r);
const mock = () => Cl.contractPrincipal(dep, "mock-token");
const hostile = () => Cl.contractPrincipal(dep, "hostile-venue");
const idle = (who: string) => pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(who), Cl.principal(MOCK)], dep).result);
const pos = (who: string) => pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(who), Cl.principal(HOSTILE)], dep).result);
const vaultTokens = () => pp(simnet.callReadOnlyFn("mock-token", "get-balance", [Cl.principal(VAULT)], dep).result);
const vaultShares = () => pp(simnet.callReadOnlyFn("hostile-venue", "get-balance", [Cl.principal(VAULT)], dep).result);
const mode = (m: number) => simnet.callPublicFn("hostile-venue", "set-mode", [Cl.uint(m)], dep);

function owner(who: string) {
  simnet.callPublicFn(V, "set-cap", [Cl.principal(MOCK), Cl.uint(10_000_000)], dep); // refused after the first, harmlessly
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(who)], dep);
  simnet.callPublicFn(V, "allow-asset", [Cl.principal(MOCK)], who);
  simnet.callPublicFn(V, "allow-venue", [Cl.principal(HOSTILE), Cl.principal(MOCK)], who);
  simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(400_000)], who);
  simnet.callPublicFn(V, "grant", [Cl.principal(agentX), Cl.uint(500_000), Cl.uint(9_999_999), Cl.uint(100),
    Cl.uint(100), Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000)], who);
}
const allocate = (who: string, n: number) =>
  simnet.callPublicFn(V, "allocate", [Cl.principal(who), hostile(), mock(), Cl.uint(n)], agentX);
const unwind = (who: string, n: number) =>
  simnet.callPublicFn(V, "unwind", [Cl.principal(who), hostile(), mock(), Cl.uint(n)], agentX);
const ownerUnwind = (who: string, n: number) =>
  simnet.callPublicFn(V, "owner-unwind", [hostile(), mock(), Cl.uint(n), Cl.uint(1)], who);
const snap = () => [idle(alice), pos(alice), vaultTokens(), vaultShares()].join(" | ");

describe("v4 against a hostile venue: measure, don't trust", () => {
  it("control: the same venue behaving honestly passes every check", () => {
    owner(alice); mode(0);
    expect(allocate(alice, 10_000).result).toBeOk(Cl.uint(10_000));
    expect(unwind(alice, 10_000).result).toBeOk(Cl.uint(10_000));
    expect(idle(alice)).toBe("u400000");
  });

  it("takes more than the move: stopped by the allowance, nothing moves", () => {
    owner(alice); mode(1);
    const before = snap(); const r = allocate(alice, 10_000);
    console.log("  takes move + 1           :", pp(r.result), "| idle | position | vault tokens | vault shares:", snap());
    expect(r.result).toBeErr(Cl.uint(0));                              // the allowance at index 0
    expect(snap()).toBe(before);
  });

  it("reports more shares than it mints: refused", () => {
    owner(alice); mode(2);
    const before = snap(); const r = allocate(alice, 10_000);
    console.log("  reports 2x the shares    :", pp(r.result), "|", snap());
    expect(r.result).toBeErr(Cl.uint(114));                            // ERR_MISREPORT
    expect(snap()).toBe(before);
  });

  it("calls back into the vault mid-call: refused", () => {
    owner(alice); mode(4);
    const before = snap(); const r = allocate(alice, 10_000);
    console.log("  re-enters the vault      :", pp(r.result), "|", snap());
    expect(r.result).toBeErr(Cl.uint(105));   // ran as the vault itself, which has no ledger
    expect(snap()).toBe(before);
  });

  it("the vault can't be granted as its own delegate, so a callback can't act on a mandate", () => {
    owner(alice);
    const r = simnet.callPublicFn(V, "grant", [Cl.principal(VAULT), Cl.uint(500_000), Cl.uint(9_999_999),
      Cl.uint(100), Cl.uint(100), Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000)], alice);
    console.log("  grant to the vault itself:", pp(r.result));
    expect(r.result).toBeErr(Cl.uint(115));                            // ERR_AGENT
  });

  it("pays less than it reports on redeem: refused, for the delegate and the owner", () => {
    owner(alice); mode(0); allocate(alice, 10_000);
    mode(3);
    const before = snap(); const r = unwind(alice, 10_000); const o = ownerUnwind(alice, 10_000);
    console.log("  pays half, reports full  :", pp(r.result), "(delegate)", pp(o.result), "(owner) |", snap());
    expect(r.result).toBeErr(Cl.uint(114));
    expect(o.result).toBeErr(Cl.uint(114));
    expect(snap()).toBe(before);
  });

  it("burns more shares than asked: refused, and another owner's shares are safe", () => {
    owner(alice); owner(bob); mode(0);
    allocate(alice, 10_000); allocate(bob, 10_000);
    mode(5);
    const before = snap() + " | bob " + pos(bob); const r = unwind(alice, 10_000);
    console.log("  burns asked + 1          :", pp(r.result), "|", snap(), "| bob", pos(bob));
    expect(r.result).toBeErr(Cl.uint(0));                              // the allowance at index 0
    expect(snap() + " | bob " + pos(bob)).toBe(before);
  });
});
