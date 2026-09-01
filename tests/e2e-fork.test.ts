import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const BF    = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const SBTC  = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1"; // real sBTC holder on mainnet
const a = simnet.getAccounts();
const agentX = a.get("wallet_3")!;
const V = "mandate-vault-v2";

const pool = () => Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1");
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const yTok = () => Cl.contractPrincipal(BF, "token-stx-v-1-2");
const SBTC_P = `${SBTC}.sbtc-token`;
const STX_P  = `${BF}.token-stx-v-1-2`;

const led = (who: string, tok: string) =>
  Cl.prettyPrint(simnet.callReadOnlyFn(V, "balance-of",
    [Cl.principal(who), Cl.principal(tok)], who).result);

describe("REGRESSION: Bitflow pools refuse a contract recipient", () => {
  it("deposits real sBTC, but the pool rejects the vault as recipient",
     { timeout: 300000 }, () => {
    const AMT = 100_000; // 0.001 BTC

    simnet.callPublicFn(V, "allow-asset", [xTok()], WHALE);
    simnet.callPublicFn(V, "allow-asset", [yTok()], WHALE);
    simnet.callPublicFn(V, "allow-venue", [pool()], WHALE);

    const dep = simnet.callPublicFn(V, "deposit", [xTok(), Cl.uint(AMT)], WHALE);
    console.log("  deposit real sBTC   :", Cl.prettyPrint(dep.result));
    console.log("  ledger sBTC         :", led(WHALE, SBTC_P));

    // agent gets trade-only authority, 1% max slippage
    simnet.callPublicFn(V, "grant", [
      Cl.principal(agentX), Cl.uint(AMT), Cl.uint(9_999_999), Cl.uint(100),
      Cl.uint(10), Cl.uint(144), Cl.uint(10_000_000), Cl.uint(10_000),
    ], WHALE);

    const ex = simnet.callPublicFn(V, "execute",
      [Cl.principal(WHALE), pool(), xTok(), yTok(), Cl.uint(AMT)], agentX);
    console.log("  agent executes swap :", Cl.prettyPrint(ex.result));
    console.log("  ledger sBTC after   :", led(WHALE, SBTC_P));
    console.log("  ledger STX  after   :", led(WHALE, STX_P));

    // the agent cannot take the proceeds out
    const steal = simnet.callPublicFn(V, "withdraw", [yTok(), Cl.uint(1)], agentX);
    console.log("  agent tries withdraw:", Cl.prettyPrint(steal.result));
    expect(steal.result).toBeErr(Cl.uint(105));

    // u3003 = ERR_INVALID_PRINCIPAL from xyk-pool-sbtc-stx-v-1-1.pool-transfer,
    // which asserts (is-standard recipient). This is why the product moved to
    // yield allocation. Pinned as a regression test.
    expect(ex.result).toBeErr(Cl.uint(3003));
    expect(Cl.prettyPrint(dep.result)).toBe("(ok true)");   // custody itself works
  });
});
