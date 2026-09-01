import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const SBTC  = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1";
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");

describe("Zest against forked mainnet -- can a CONTRACT be the depositor?", () => {
  it("funds the probe with real sBTC and allocates it into Zest",
     { timeout: 300000 }, () => {
    const AMT = 100_000;
    const f = simnet.callPublicFn("zest-probe", "fund", [xTok(), Cl.uint(AMT)], WHALE);
    console.log("  fund probe with real sBTC :", Cl.prettyPrint(f.result));

    const r = simnet.callPublicFn("zest-probe", "allocate",
      [Cl.uint(AMT), Cl.uint(1)], WHALE);
    console.log("  contract deposits to Zest :", Cl.prettyPrint(r.result));
    // Bitflow returned u3003 here. Zest should mint shares to the contract.
    expect(Cl.prettyPrint(r.result)).toMatch(/^\(ok u\d+\)$/);

    // the round trip matters: an owner must be able to get out
    const shares = Number(Cl.prettyPrint(r.result).match(/u(\d+)/)![1]);
    const u = simnet.callPublicFn("zest-probe", "unwind",
      [Cl.uint(shares), Cl.uint(1)], WHALE);
    console.log("  contract redeems from Zest:", Cl.prettyPrint(u.result));
    expect(Cl.prettyPrint(u.result)).toMatch(/^\(ok u\d+\)$/);
  });
});
