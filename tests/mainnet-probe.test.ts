import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
const SBTC  = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1";
const a = simnet.getAccounts();
const stranger = a.get("wallet_2")!;
const dep = simnet.deployer;
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const P = "mandate-probe-mainnet";

describe("mainnet probe -- safe to deploy with real funds", () => {
  it("round trips through Zest and the owner can always get out",
     { timeout: 300000 }, () => {
    const AMT = 100_000;
    simnet.callPublicFn(P, "fund", [xTok(), Cl.uint(AMT)], WHALE);

    const al = simnet.callPublicFn(P, "allocate", [Cl.uint(AMT), Cl.uint(1)], dep);
    console.log("  owner allocates to Zest :", Cl.prettyPrint(al.result));
    const shares = Number(Cl.prettyPrint(al.result).match(/u(\d+)/)![1]);

    const un = simnet.callPublicFn(P, "unwind", [Cl.uint(shares), Cl.uint(1)], dep);
    console.log("  owner unwinds           :", Cl.prettyPrint(un.result));

    const rs = simnet.callPublicFn(P, "rescue", [xTok(), Cl.uint(50_000)], dep);
    console.log("  owner rescues to wallet :", Cl.prettyPrint(rs.result));
    expect(rs.result).toBeOk(Cl.bool(true));
  });

  it("a stranger can neither allocate nor drain it", { timeout: 300000 }, () => {
    const bad1 = simnet.callPublicFn(P, "allocate", [Cl.uint(1000), Cl.uint(1)], stranger);
    const bad2 = simnet.callPublicFn(P, "rescue", [xTok(), Cl.uint(1)], stranger);
    console.log("  stranger allocate       :", Cl.prettyPrint(bad1.result));
    console.log("  stranger rescue         :", Cl.prettyPrint(bad2.result));
    expect(bad1.result).toBeErr(Cl.uint(401));
    expect(bad2.result).toBeErr(Cl.uint(401));
  });
});
