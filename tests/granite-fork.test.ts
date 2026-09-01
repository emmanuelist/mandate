import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
const SBTC  = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1";
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");

describe("Granite against forked mainnet -- contract as collateral poster", () => {
  it("funds the probe and posts real sBTC collateral", { timeout: 300000 }, () => {
    const AMT = 100_000;
    const f = simnet.callPublicFn("granite-probe", "fund", [xTok(), Cl.uint(AMT)], WHALE);
    console.log("  fund probe with real sBTC   :", Cl.prettyPrint(f.result));
    const r = simnet.callPublicFn("granite-probe", "post-collateral",
      [xTok(), Cl.uint(AMT)], WHALE);
    console.log("  contract posts collateral   :", Cl.prettyPrint(r.result));
    expect(Cl.prettyPrint(r.result)).not.toMatch(/u3003/);
  });
});
