import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// #40: v3 identifies owners and delegates by tx-sender, so a contract an owner
// calls can act as that owner. v4 identifies them by contract-caller, and v5 keeps
// that rule.
const a = simnet.getAccounts();
const dep = simnet.deployer;
const alice = a.get("wallet_1")!;
const MOCK = `${dep}.mock-token`;
const PHISH_VENUE = `${dep}.phish-venue`;

const pp = (r: any) => Cl.prettyPrint(r);
const mock = () => Cl.contractPrincipal(dep, "mock-token");
const phishVenue = () => Cl.contractPrincipal(dep, "phish-venue");
const tokenOf = (who: string) =>
  pp(simnet.callReadOnlyFn("mock-token", "get-balance", [Cl.principal(who)], dep).result);
const idle = (V: string, who: string) =>
  pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(who), Cl.principal(MOCK)], dep).result);
const position = (V: string, who: string) =>
  pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(who), Cl.principal(PHISH_VENUE)], dep).result);

function fund(V: string, who: string, amount: number) {
  if (!V.endsWith("v3")) simnet.callPublicFn(V, "set-cap", [Cl.principal(MOCK), Cl.uint(10_000_000)], dep);
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(amount), Cl.principal(who)], dep);
  simnet.callPublicFn(V, "allow-asset", [Cl.principal(MOCK)], who);
  expect(simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(amount)], who).result).toBeOk(Cl.bool(true));
}

describe("a contract the owner calls, acting as the owner (#40)", () => {
  it("v3: a contract the owner calls moves the owner's idle funds into its own venue", () => {
    const V = "mandate-vault-v3";
    fund(V, alice, 400_000);
    const r = simnet.callPublicFn("phisher-v3", "claim-airdrop", [], alice);
    const back = simnet.callPublicFn(V, "owner-unwind", [phishVenue(), mock(), Cl.uint(400_000), Cl.uint(1)], alice);
    console.log("  v3, alice claims airdrop :", pp(r.result), "| alice idle", idle(V, alice), "| position", position(V, alice),
      "| phish venue holds", tokenOf(PHISH_VENUE), "| alice unwinds:", pp(back.result));
    expect(r.result).toBeOk(Cl.uint(400_000));
    expect(idle(V, alice)).toBe("u0");
    expect(position(V, alice)).toBe("u400000");
    expect(tokenOf(PHISH_VENUE)).toBe("(ok u400000)");
    expect(back.result).toBeErr(Cl.uint(404));                // the venue never pays it back
  });

  it("v5: the same call is refused, and nothing moves", () => {
    const V = "mandate-vault-v5";
    fund(V, alice, 400_000);
    const r = simnet.callPublicFn("phisher-v5", "claim-airdrop", [], alice);
    console.log("  v5, alice claims airdrop :", pp(r.result), "| alice idle", idle(V, alice), "| position", position(V, alice),
      "| phish venue holds", tokenOf(PHISH_VENUE));
    expect(r.result).toBeErr(Cl.uint(100));                   // no mandate from alice to the contract that called
    expect(idle(V, alice)).toBe("u400000");
    expect(position(V, alice)).toBe("u0");
    expect(tokenOf(PHISH_VENUE)).toBe("(ok u0)");
    expect(pp(simnet.callReadOnlyFn(V, "venue-asset", [Cl.principal(alice), Cl.principal(PHISH_VENUE)], dep).result)).toBe("none");
  });

  it("v5: a contract acting for itself, from inside as-contract?, deposits and withdraws", () => {
    const V = "mandate-vault-v5";
    const SELF = `${dep}.self-owner`;
    simnet.callPublicFn(V, "set-cap", [Cl.principal(MOCK), Cl.uint(10_000_000)], dep);
    simnet.callPublicFn("mock-token", "mint", [Cl.uint(50_000), Cl.principal(SELF)], dep);
    const d = simnet.callPublicFn("self-owner", "deposit", [Cl.uint(50_000)], alice);
    const held = idle(V, SELF);
    const w = simnet.callPublicFn("self-owner", "withdraw", [Cl.uint(50_000)], alice);
    console.log("  contract owner           : deposit", pp(d.result), "| idle", held, "| withdraw", pp(w.result),
      "| its tokens", tokenOf(SELF));
    expect(d.result).toBeOk(Cl.bool(true));
    expect(held).toBe("u50000");
    expect(w.result).toBeOk(Cl.bool(true));
    expect(idle(V, SELF)).toBe("u0");
    expect(tokenOf(SELF)).toBe("(ok u50000)");
  });
});
