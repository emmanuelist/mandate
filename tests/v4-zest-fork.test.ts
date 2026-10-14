import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// mandate-vault-v4 against Zest's real v0-vault-sbtc on a mainnet fork, with
// no adapter: the vault is Zest's contract-caller (D-009).
const SBTC_ADDR = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const ZEST_ADDR = "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7";
const OWNER = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1"; // real sBTC holder on mainnet
const SBTC = `${SBTC_ADDR}.sbtc-token`;
const ZEST = `${ZEST_ADDR}.v0-vault-sbtc`;

const dep = simnet.deployer;
const agentX = simnet.getAccounts().get("wallet_3")!;
const V = "mandate-vault-v4";
const VAULT = `${dep}.${V}`;
const AMT = 100_000;

const pp = (r: any) => Cl.prettyPrint(r);
const sbtc = () => Cl.contractPrincipal(SBTC_ADDR, "sbtc-token");
const zest = () => Cl.contractPrincipal(ZEST_ADDR, "v0-vault-sbtc");
const num = (s: string) => Number(s.match(/u(\d+)/)?.[1] ?? NaN);
const sbtcOf = (who: string) => num(pp(simnet.callReadOnlyFn(SBTC, "get-balance", [Cl.principal(who)], dep).result));
const zestSharesOf = (who: string) => num(pp(simnet.callReadOnlyFn(ZEST, "get-balance", [Cl.principal(who)], dep).result));
const idle = () => num(pp(simnet.callReadOnlyFn(V, "balance-of", [Cl.principal(OWNER), Cl.principal(SBTC)], dep).result));
const position = () => num(pp(simnet.callReadOnlyFn(V, "shares-of", [Cl.principal(OWNER), Cl.principal(ZEST)], dep).result));

function setup(opts: Partial<{ cap: number; expires: number; slip: number; trades: number; daily: number }> = {}) {
  simnet.callPublicFn(V, "set-cap", [Cl.principal(SBTC), Cl.uint(1_000_000)], dep); // 0.01 BTC, the mainnet cap (D-018)
  simnet.callPublicFn(V, "allow-asset", [Cl.principal(SBTC)], OWNER);
  simnet.callPublicFn(V, "allow-venue", [Cl.principal(ZEST), Cl.principal(SBTC)], OWNER);
  const d = simnet.callPublicFn(V, "deposit", [sbtc(), Cl.uint(AMT)], OWNER);
  expect(d.result).toBeOk(Cl.bool(true));
  simnet.callPublicFn(V, "grant", [
    Cl.principal(agentX), Cl.uint(opts.cap ?? 500_000), Cl.uint(opts.expires ?? 9_999_999),
    Cl.uint(opts.slip ?? 100), Cl.uint(opts.trades ?? 100), Cl.uint(144),
    Cl.uint(opts.daily ?? 10_000_000), Cl.uint(10_000),
  ], OWNER);
}
const allocate = (amount = AMT) =>
  simnet.callPublicFn(V, "allocate", [Cl.principal(OWNER), zest(), sbtc(), Cl.uint(amount)], agentX);
const unwind = (shares: number) =>
  simnet.callPublicFn(V, "unwind", [Cl.principal(OWNER), zest(), sbtc(), Cl.uint(shares)], agentX);
const ownerUnwind = (shares: number) =>
  simnet.callPublicFn(V, "owner-unwind", [zest(), sbtc(), Cl.uint(shares), Cl.uint(1)], OWNER);

describe("v4 against Zest's v0-vault-sbtc on a mainnet fork, with no adapter", () => {
  it("deposit, allocate, unwind, withdraw: every sat accounted for", () => {
    const walletStart = sbtcOf(OWNER);
    setup();
    console.log("  deposit 100000 sats      : idle", idle(), "| vault sBTC", sbtcOf(VAULT));
    expect(idle()).toBe(AMT);
    expect(sbtcOf(VAULT)).toBe(AMT);

    const quote = num(pp(simnet.callReadOnlyFn(ZEST, "convert-to-shares", [Cl.uint(AMT)], dep).result));
    const al = allocate();
    const shares = num(pp(al.result));
    console.log("  delegate allocates       :", pp(al.result), "| quote", quote,
      "| vault holds", zestSharesOf(VAULT), "Zest shares | delegate holds", zestSharesOf(agentX),
      "| vault sBTC", sbtcOf(VAULT));
    expect(al.result).toBeOk(Cl.uint(shares));
    expect(shares).toBe(quote);                    // Zest fills exactly at its quote
    expect(position()).toBe(shares);
    expect(zestSharesOf(VAULT)).toBe(shares);      // the vault holds its own shares
    expect(zestSharesOf(agentX)).toBe(0);
    expect(sbtcOf(VAULT)).toBe(0);
    expect(idle()).toBe(0);

    const out = num(pp(simnet.callReadOnlyFn(ZEST, "convert-to-assets", [Cl.uint(shares)], dep).result));
    const un = unwind(shares);
    const back = num(pp(un.result));
    console.log("  delegate unwinds         :", pp(un.result), "| quote", out,
      "| idle", idle(), "| vault sBTC", sbtcOf(VAULT), "| vault Zest shares", zestSharesOf(VAULT));
    expect(back).toBe(out);
    expect(idle()).toBe(back);
    expect(sbtcOf(VAULT)).toBe(back);              // ledger and real balance agree to the sat
    expect(zestSharesOf(VAULT)).toBe(0);
    expect(position()).toBe(0);

    const wd = simnet.callPublicFn(V, "withdraw", [sbtc(), Cl.uint(back)], OWNER);
    const walletEnd = sbtcOf(OWNER);
    console.log("  owner withdraws          :", pp(wd.result), "| wallet change", walletEnd - walletStart,
      "sats | left in vault", sbtcOf(VAULT));
    expect(wd.result).toBeOk(Cl.bool(true));
    expect(walletEnd - walletStart).toBe(back - AMT); // the only loss is Zest's share rounding
    expect(sbtcOf(VAULT)).toBe(0);
  });

  it("a zero-slippage mandate still allocates, because Zest fills at its quote", () => {
    setup({ slip: 0 });
    const r = allocate();
    console.log("  allocate with 0 bps slippage:", pp(r.result));
    expect(pp(r.result)).toMatch(/^\(ok u\d+\)$/);
  });

  it("the owner exits Zest without a mandate after revoking, then withdraws", () => {
    setup();
    const shares = num(pp(allocate().result));
    simnet.callPublicFn(V, "revoke", [Cl.principal(agentX)], OWNER);
    const agentTry = unwind(shares);
    const own = ownerUnwind(shares);
    const back = num(pp(own.result));
    const wd = simnet.callPublicFn(V, "withdraw", [sbtc(), Cl.uint(back)], OWNER);
    console.log("  after revoke: delegate", pp(agentTry.result), "| owner exits", pp(own.result), "| withdraw", pp(wd.result));
    expect(agentTry.result).toBeErr(Cl.uint(100));
    expect(back).toBeGreaterThan(0);
    expect(wd.result).toBeOk(Cl.bool(true));
    expect(zestSharesOf(VAULT)).toBe(0);
  });

  it("the owner exits Zest after the mandate expires", () => {
    setup();
    const shares = num(pp(allocate().result));
    simnet.callPublicFn(V, "grant", [Cl.principal(agentX), Cl.uint(500_000), Cl.uint(1), Cl.uint(100),
      Cl.uint(100), Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000)], OWNER);
    expect(unwind(shares).result).toBeErr(Cl.uint(103));
    expect(pp(ownerUnwind(shares).result)).toMatch(/^\(ok u\d+\)$/);
  });

  it("policy refusals hold with Zest as the venue, and nothing leaves the vault", () => {
    const cases: [string, Partial<{ cap: number; expires: number; trades: number; daily: number }>, () => any, number][] = [
      ["per-move cap", { cap: 1_000 }, () => allocate(), 102],
      ["expired", { expires: 1 }, () => allocate(), 103],
      ["rate window", { trades: 0 }, () => allocate(), 110],
      ["daily cap", { daily: 50_000 }, () => allocate(), 111],
      ["more than idle", {}, () => allocate(AMT + 1), 105],
    ];
    for (const [name, opts, call, code] of cases) {
      setup(opts);
      const r = call();
      console.log(`  ${name.padEnd(13)}:`, pp(r.result), "| vault sBTC", sbtcOf(VAULT), "| vault Zest shares", zestSharesOf(VAULT));
      expect(r.result).toBeErr(Cl.uint(code));
      expect(zestSharesOf(VAULT)).toBe(0);
      simnet.callPublicFn(V, "withdraw", [sbtc(), Cl.uint(AMT)], OWNER);   // reset for the next case
    }
  });

  it("refuses Zest unless the owner allowlisted it, for sBTC", () => {
    setup();
    simnet.callPublicFn(V, "disallow-venue", [Cl.principal(ZEST)], OWNER);
    expect(allocate().result).toBeErr(Cl.uint(107));
    simnet.callPublicFn(V, "allow-venue", [Cl.principal(ZEST), Cl.principal(`${dep}.mock-token`)], OWNER);
    expect(allocate().result).toBeErr(Cl.uint(107));
    const noMandate = simnet.callPublicFn(V, "allocate", [Cl.principal(OWNER), zest(), sbtc(), Cl.uint(AMT)], OWNER);
    expect(noMandate.result).toBeErr(Cl.uint(100));       // the owner isn't their own delegate
  });
});
