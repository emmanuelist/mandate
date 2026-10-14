import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// mandate-vault-v5 and the testnet sBTC venue against testnet's official sBTC, on
// a testnet fork pinned at block 719800 (Clarinet-testnet.toml). The same pairing
// runs on testnet itself (#26).
const SBTC_ADDR = "SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1";
const OWNER = "STMN69T7KZRPHM55Z5N8BAFQWKGFR56VVMD3H5E3"; // real testnet sBTC holder
const SBTC = `${SBTC_ADDR}.sbtc-token`;

const dep = simnet.deployer;
const agentX = simnet.getAccounts().get("wallet_3")!;
const V = "mandate-vault-v5";
const VAULT = `${dep}.${V}`;
const VENUE = `${dep}.mock-venue-sbtc`;
const AMT = 100_000;

const pp = (r: any) => Cl.prettyPrint(r);
const sbtc = () => Cl.contractPrincipal(SBTC_ADDR, "sbtc-token");
const venue = () => Cl.contractPrincipal(dep, "mock-venue-sbtc");
const num = (s: string) => Number(s.match(/u(\d+)/)?.[1] ?? NaN);
const sbtcOf = (who: string) => num(pp(simnet.callReadOnlyFn(SBTC, "get-balance", [Cl.principal(who)], dep).result));
const sharesOf = (who: string) => num(pp(simnet.callReadOnlyFn(VENUE, "get-balance", [Cl.principal(who)], dep).result));
const idle = () => num(pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(OWNER), Cl.principal(SBTC)], dep).result));
const position = () => num(pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(OWNER), Cl.principal(VENUE)], dep).result));

function setup() {
  simnet.callPublicFn(V, "set-cap", [Cl.principal(SBTC), Cl.uint(1_000_000)], dep);
  expect(simnet.callPublicFn(V, "allow-asset", [Cl.principal(SBTC)], OWNER).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn(V, "allow-venue", [Cl.principal(VENUE), Cl.principal(SBTC)], OWNER).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn(V, "deposit", [sbtc(), Cl.uint(AMT)], OWNER).result).toBeOk(Cl.bool(true));
  expect(simnet.callPublicFn(V, "grant", [
    Cl.principal(agentX), Cl.uint(500_000), Cl.uint(9_999_999), Cl.uint(100),
    Cl.uint(100), Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000),
  ], OWNER).result).toBeOk(Cl.bool(true));
}
const allocate = (amount = AMT) =>
  simnet.callPublicFn(V, "allocate", [Cl.principal(OWNER), venue(), sbtc(), Cl.uint(amount)], agentX);

describe("v3 with testnet's official sBTC on a testnet fork", () => {
  it("testnet sBTC: deposit, allocate, unwind, withdraw, every sat accounted for", () => {
    const walletStart = sbtcOf(OWNER);
    setup();
    console.log("  deposit 100000 sats      : idle", idle(), "| vault sBTC", sbtcOf(VAULT), "| owner wallet", walletStart, "before");
    expect(idle()).toBe(AMT);
    expect(sbtcOf(VAULT)).toBe(AMT);

    const al = allocate();
    console.log("  delegate allocates       :", pp(al.result), "| vault holds", sharesOf(VAULT),
      "shares | venue sBTC", sbtcOf(VENUE), "| vault sBTC", sbtcOf(VAULT));
    expect(al.result).toBeOk(Cl.uint(AMT));
    expect(position()).toBe(AMT);
    expect(sharesOf(VAULT)).toBe(AMT);
    expect(sbtcOf(VENUE)).toBe(AMT);
    expect(sbtcOf(VAULT)).toBe(0);

    const un = simnet.callPublicFn(V, "unwind", [Cl.principal(OWNER), venue(), sbtc(), Cl.uint(AMT)], agentX);
    console.log("  delegate unwinds         :", pp(un.result), "| idle", idle(), "| vault sBTC", sbtcOf(VAULT),
      "| venue sBTC", sbtcOf(VENUE));
    expect(un.result).toBeOk(Cl.uint(AMT));
    expect(idle()).toBe(AMT);
    expect(sbtcOf(VAULT)).toBe(AMT);
    expect(sbtcOf(VENUE)).toBe(0);
    expect(position()).toBe(0);

    const wd = simnet.callPublicFn(V, "withdraw", [sbtc(), Cl.uint(AMT)], OWNER);
    console.log("  owner withdraws          :", pp(wd.result), "| wallet change", sbtcOf(OWNER) - walletStart,
      "| vault sBTC", sbtcOf(VAULT));
    expect(wd.result).toBeOk(Cl.bool(true));
    expect(sbtcOf(OWNER)).toBe(walletStart);
    expect(sbtcOf(VAULT)).toBe(0);
  });

  it("testnet sBTC: a fill below the slippage floor is refused, and nothing moves", () => {
    setup();
    simnet.callPublicFn("mock-venue-sbtc", "set-haircut", [Cl.uint(200)], dep); // 2%, against a 1% limit
    const al = allocate();
    console.log("  2% haircut, 1% limit     :", pp(al.result), "| idle", idle(), "| vault sBTC", sbtcOf(VAULT));
    expect(al.result).toBeErr(Cl.uint(201));                           // the venue enforces our floor
    expect(idle()).toBe(AMT);
    expect(sbtcOf(VAULT)).toBe(AMT);
    expect(position()).toBe(0);
  });
});
