import { Cl } from "@stacks/transactions";
import { describe, it } from "vitest";
const SBTC  = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1";
const dep = simnet.deployer;
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const P = "mandate-probe-mainnet";

describe("DRY RUN of the exact mainnet sequence, 7000 sats", () => {
  it("fund -> allocate -> unwind -> rescue", () => {
    const AMT = 7000;
    const f = simnet.callPublicFn(P, "fund", [xTok(), Cl.uint(AMT)], WHALE);
    console.log("  1 fund(sbtc, 7000)        ->", Cl.prettyPrint(f.result));

    const al = simnet.callPublicFn(P, "allocate", [Cl.uint(AMT), Cl.uint(1)], dep);
    console.log("  2 allocate(7000, 1)       ->", Cl.prettyPrint(al.result));
    const shares = Number(Cl.prettyPrint(al.result).match(/u(\d+)/)?.[1] ?? 0);

    const un = simnet.callPublicFn(P, "unwind", [Cl.uint(shares), Cl.uint(1)], dep);
    console.log(`  3 unwind(${shares}, 1)        ->`, Cl.prettyPrint(un.result));
    const back = Number(Cl.prettyPrint(un.result).match(/u(\d+)/)?.[1] ?? 0);

    const rs = simnet.callPublicFn(P, "rescue", [xTok(), Cl.uint(back)], dep);
    console.log(`  4 rescue(sbtc, ${back})     ->`, Cl.prettyPrint(rs.result));
  });
});
