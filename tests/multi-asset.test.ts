import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const SBTC  = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const ZEST  = "SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1";
const dep   = simnet.deployer;
const P = "multi-asset-probe";

const sbtc  = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const wstx  = () => Cl.contractPrincipal(ZEST, "wstx");
const vSbtc = () => Cl.contractPrincipal(ZEST, "v0-vault-sbtc");
const vStx  = () => Cl.contractPrincipal(ZEST, "v0-vault-stx");

describe("one adapter, two assets -- can an STX holder use this?", () => {
  it("sBTC path: fund, allocate, unwind", () => {
    simnet.callPublicFn(P, "fund", [sbtc(), Cl.uint(100_000)], WHALE);
    const a = simnet.callPublicFn(P, "allocate", [vSbtc(), Cl.uint(100_000), Cl.uint(1)], dep);
    console.log("  sBTC allocate ->", Cl.prettyPrint(a.result));
    const sh = Number(Cl.prettyPrint(a.result).match(/u(\d+)/)?.[1] ?? 0);
    const u = simnet.callPublicFn(P, "unwind", [vSbtc(), Cl.uint(sh), Cl.uint(1)], dep);
    console.log("  sBTC unwind   ->", Cl.prettyPrint(u.result));
    expect(Cl.prettyPrint(a.result)).toMatch(/^\(ok u\d+\)$/);
  });

  it("STX path: same adapter, no wrapping step", () => {
    const AMT = 10_000_000; // 10 STX
    const f = simnet.callPublicFn(P, "fund", [wstx(), Cl.uint(AMT)], dep);
    console.log("  STX fund      ->", Cl.prettyPrint(f.result));
    const a = simnet.callPublicFn(P, "allocate", [vStx(), Cl.uint(AMT), Cl.uint(1)], dep);
    console.log("  STX allocate  ->", Cl.prettyPrint(a.result));
    const sh = Number(Cl.prettyPrint(a.result).match(/u(\d+)/)?.[1] ?? 0);
    const u = simnet.callPublicFn(P, "unwind", [vStx(), Cl.uint(sh), Cl.uint(1)], dep);
    console.log("  STX unwind    ->", Cl.prettyPrint(u.result));
    expect(Cl.prettyPrint(a.result)).toMatch(/^\(ok u\d+\)$/);
  });
});
