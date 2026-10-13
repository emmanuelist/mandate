import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1"; // real sBTC holder on mainnet
const ZEST_ADDR = "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7";
const zest = () => Cl.contractPrincipal(ZEST_ADDR, "v0-vault-sbtc");
const sbtc = () => Cl.contractPrincipal(SBTC, "sbtc-token");

describe("SPIKE #4: a contract reaches Zest through its own venue trait", () => {
  it("quotes, deposits and redeems real sBTC with no adapter in between", () => {
    const D = simnet.deployer;
    const spike = `${D}.venue-spike`;
    const AMT = 100_000;
    const sbtcOf = () =>
      Cl.prettyPrint(simnet.callReadOnlyFn(`${SBTC}.sbtc-token`, "get-balance", [Cl.principal(spike)], D).result);
    const sharesOf = () =>
      Cl.prettyPrint(simnet.callReadOnlyFn(`${ZEST_ADDR}.v0-vault-sbtc`, "get-balance", [Cl.principal(spike)], D).result);

    const fund = simnet.callPublicFn(`${SBTC}.sbtc-token`, "transfer",
      [Cl.uint(AMT), Cl.principal(WHALE), Cl.principal(spike), Cl.none()], WHALE);
    console.log("  fund spike with real sBTC   :", Cl.prettyPrint(fund.result));

    const q = simnet.callPublicFn("venue-spike", "quote-in", [zest(), Cl.uint(AMT)], D);
    console.log("  quote via venue trait       :", Cl.prettyPrint(q.result));
    const quoted = Number(Cl.prettyPrint(q.result).match(/u(\d+)/)?.[1] ?? 0);

    const a = simnet.callPublicFn("venue-spike", "allocate", [zest(), sbtc(), Cl.uint(AMT), Cl.uint(quoted)], D);
    console.log("  deposit via venue trait     :", Cl.prettyPrint(a.result));
    console.log("  spike sBTC / Zest shares    :", sbtcOf(), "/", sharesOf());
    const shares = Number(Cl.prettyPrint(a.result).match(/u(\d+)/)?.[1] ?? 0);

    const qo = simnet.callPublicFn("venue-spike", "quote-out", [zest(), Cl.uint(shares)], D);
    console.log("  quote out via venue trait   :", Cl.prettyPrint(qo.result));
    const u = simnet.callPublicFn("venue-spike", "unwind", [zest(), Cl.uint(shares), Cl.uint(1)], D);
    console.log("  redeem via venue trait      :", Cl.prettyPrint(u.result));
    console.log("  spike sBTC / Zest shares    :", sbtcOf(), "/", sharesOf());

    expect(Cl.prettyPrint(fund.result)).toBe("(ok true)");
    expect(Cl.prettyPrint(a.result)).toMatch(/^\(ok u\d+\)$/);
    expect(shares).toBeGreaterThanOrEqual(quoted);
    expect(Cl.prettyPrint(u.result)).toMatch(/^\(ok u\d+\)$/);
    expect(sharesOf()).toBe("(ok u0)");
  });
});
