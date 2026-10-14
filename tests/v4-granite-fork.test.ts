import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// mandate-vault-v4 against Granite's real USDCx lending pool on a mainnet fork,
// through contracts/granite-venue.clar, which holds Granite's LP tokens and mints
// its own shares (D-020).
const USDCX_ADDR = "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE";
const STATE = "SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.state-v1";
const OWNER = "SP3A7MGAH0SKC1ACS854PHXHVWE031FYQCBA8M51D"; // real USDCx holder on mainnet
const USDCX = `${USDCX_ADDR}.usdcx`;

const dep = simnet.deployer;
const agentX = simnet.getAccounts().get("wallet_3")!;
const V = "mandate-vault-v4";
const VAULT = `${dep}.${V}`;
const ADAPTER = `${dep}.granite-venue`;
const CAP = 1_000_000_000; // 1,000 USDCx, the mainnet cap (D-020)
const AMT = 100_000_000;   // 100 USDCx

const pp = (r: any) => Cl.prettyPrint(r);
const usdcx = () => Cl.contractPrincipal(USDCX_ADDR, "usdcx");
const venue = () => Cl.contractPrincipal(dep, "granite-venue");
const num = (s: string) => Number(s.match(/u(\d+)/)?.[1] ?? NaN);
const usdcxOf = (who: string) => num(pp(simnet.callReadOnlyFn(USDCX, "get-balance", [Cl.principal(who)], dep).result));
const lpOf = (who: string) => num(pp(simnet.callReadOnlyFn(STATE, "get-balance", [Cl.principal(who)], dep).result));
const sharesOf = (who: string) => num(pp(simnet.callReadOnlyFn("granite-venue", "get-balance", [Cl.principal(who)], dep).result));
const quote = (fn: string, n: number) => num(pp(simnet.callReadOnlyFn("granite-venue", fn, [Cl.uint(n)], dep).result));
const idle = () => num(pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(OWNER), Cl.principal(USDCX)], dep).result));
const position = () => num(pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(OWNER), Cl.principal(ADAPTER)], dep).result));

function setup(opts: Partial<{ cap: number }> = {}) {
  simnet.callPublicFn(V, "set-cap", [Cl.principal(USDCX), Cl.uint(CAP)], dep);
  simnet.callPublicFn(V, "allow-asset", [Cl.principal(USDCX)], OWNER);
  simnet.callPublicFn(V, "allow-venue", [Cl.principal(ADAPTER), Cl.principal(USDCX)], OWNER);
  expect(simnet.callPublicFn(V, "deposit", [usdcx(), Cl.uint(AMT)], OWNER).result).toBeOk(Cl.bool(true));
  simnet.callPublicFn(V, "grant", [
    Cl.principal(agentX), Cl.uint(opts.cap ?? AMT), Cl.uint(9_999_999), Cl.uint(100),
    Cl.uint(100), Cl.uint(144), Cl.uint(1_000_000_000), Cl.uint(10_000),
  ], OWNER);
}
const allocate = (amount = AMT) =>
  simnet.callPublicFn(V, "allocate", [Cl.principal(OWNER), venue(), usdcx(), Cl.uint(amount)], agentX);

describe("v4 against Granite's USDCx lending pool on a mainnet fork, through the adapter", () => {
  it("Granite: deposit, allocate, unwind, withdraw: every unit accounted for", () => {
    const walletStart = usdcxOf(OWNER);
    setup();
    const q = quote("convert-to-shares", AMT);
    const al = allocate();
    const shares = num(pp(al.result));
    console.log("  delegate allocates       :", pp(al.result), "| quote", q, "| vault holds", sharesOf(VAULT),
      "adapter shares | adapter holds", lpOf(ADAPTER), "LP | vault USDCx", usdcxOf(VAULT), "| wallet", walletStart, "before");
    expect(al.result).toBeOk(Cl.uint(shares));
    expect(shares).toBeGreaterThan(0);
    expect(sharesOf(VAULT)).toBe(shares);          // the vault holds the adapter's shares
    expect(lpOf(ADAPTER)).toBe(shares);            // one share per LP token, held by the adapter
    expect(lpOf(VAULT)).toBe(0);
    expect(position()).toBe(shares);
    expect(usdcxOf(VAULT)).toBe(0);
    expect(idle()).toBe(0);

    const out = quote("convert-to-assets", shares);
    const un = simnet.callPublicFn(V, "unwind", [Cl.principal(OWNER), venue(), usdcx(), Cl.uint(shares)], agentX);
    const back = num(pp(un.result));
    console.log("  delegate unwinds         :", pp(un.result), "| quote", out, "| idle", idle(), "| vault USDCx", usdcxOf(VAULT),
      "| adapter LP", lpOf(ADAPTER), "| adapter USDCx", usdcxOf(ADAPTER));
    expect(un.result).toBeOk(Cl.uint(back));
    expect(idle()).toBe(back);
    expect(usdcxOf(VAULT)).toBe(back);              // ledger and real balance agree to the unit
    expect(sharesOf(VAULT)).toBe(0);
    expect(lpOf(ADAPTER)).toBe(0);
    expect(usdcxOf(ADAPTER)).toBe(0);               // the adapter keeps nothing
    expect(position()).toBe(0);

    const wd = simnet.callPublicFn(V, "withdraw", [usdcx(), Cl.uint(back)], OWNER);
    console.log("  owner withdraws          :", pp(wd.result), "| wallet change", usdcxOf(OWNER) - walletStart, "| vault USDCx", usdcxOf(VAULT));
    expect(wd.result).toBeOk(Cl.bool(true));
    expect(usdcxOf(VAULT)).toBe(0);
    expect(usdcxOf(OWNER)).toBe(walletStart - AMT + back);
  });

  it("Granite: policy refusals hold through the adapter, and nothing leaves the vault", () => {
    setup({ cap: AMT / 2 });
    const big = allocate(AMT);
    const stranger = simnet.callPublicFn(V, "allocate", [Cl.principal(OWNER), venue(), usdcx(), Cl.uint(1_000)], dep);
    console.log("  above the cap, no mandate:", pp(big.result), pp(stranger.result), "| idle", idle(), "| adapter LP", lpOf(ADAPTER));
    expect(big.result).toBeErr(Cl.uint(102));
    expect(stranger.result).toBeErr(Cl.uint(100));
    expect(idle()).toBe(AMT);
    expect(usdcxOf(VAULT)).toBe(AMT);
    expect(lpOf(ADAPTER)).toBe(0);
  });

  it("Granite: the owner exits without a mandate after revoking, then withdraws", () => {
    setup();
    const shares = num(pp(allocate().result));
    simnet.callPublicFn(V, "revoke", [Cl.principal(agentX)], OWNER);
    const late = simnet.callPublicFn(V, "unwind", [Cl.principal(OWNER), venue(), usdcx(), Cl.uint(shares)], agentX);
    const exit = simnet.callPublicFn(V, "owner-unwind", [venue(), usdcx(), Cl.uint(shares), Cl.uint(1)], OWNER);
    const back = num(pp(exit.result));
    const wd = simnet.callPublicFn(V, "withdraw", [usdcx(), Cl.uint(back)], OWNER);
    console.log("  revoked, owner exits     :", pp(late.result), pp(exit.result), pp(wd.result), "| position", position(), "| adapter LP", lpOf(ADAPTER));
    expect(late.result).toBeErr(Cl.uint(100));
    expect(exit.result).toBeOk(Cl.uint(back));
    expect(wd.result).toBeOk(Cl.bool(true));
    expect(position()).toBe(0);
    expect(lpOf(ADAPTER)).toBe(0);
  });

  it("Granite: the adapter enforces the minimum Granite doesn't take, and nothing moves", () => {
    const q = quote("convert-to-shares", AMT);
    const before = usdcxOf(OWNER);
    const r = simnet.callPublicFn("granite-venue", "deposit", [Cl.uint(AMT), Cl.uint(q + 1), Cl.principal(OWNER)], OWNER);
    console.log("  minimum above the quote  :", pp(r.result), "| quote", q, "| owner USDCx change", usdcxOf(OWNER) - before, "| adapter LP", lpOf(ADAPTER));
    expect(r.result).toBeErr(Cl.uint(301));
    expect(usdcxOf(OWNER)).toBe(before);
    expect(lpOf(ADAPTER)).toBe(0);
  });
});
