import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1"; // real sBTC holder
const JING = "SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-2";
const sbtc = () => Cl.contractPrincipal(SBTC, "sbtc-token");

describe("Jing v6-2 against forked mainnet (block 9036500) -- contract as maker", () => {
  it("deposits real sBTC as a maker, is recorded as depositor, cancels back", () => {
    const D = simnet.deployer;
    const probe = `${D}.jing-probe`;
    const AMT = 10_000;
    const bal = () =>
      Cl.prettyPrint(simnet.callReadOnlyFn(`${SBTC}.sbtc-token`, "get-balance", [Cl.principal(probe)], D).result);

    const fund = simnet.callPublicFn(`${SBTC}.sbtc-token`, "transfer",
      [Cl.uint(AMT), Cl.principal(WHALE), Cl.principal(probe), Cl.none()], WHALE);
    console.log("  fund probe with real sBTC   :", Cl.prettyPrint(fund.result));
    console.log("  probe sBTC before           :", bal());

    const make = simnet.callPublicFn("jing-probe", "make", [sbtc(), Cl.uint(AMT), Cl.uint(100_000_000)], D);
    console.log("  contract posts maker order  :", Cl.prettyPrint(make.result));

    const cycle = simnet.callReadOnlyFn(JING, "get-current-cycle", [], D).result;
    const dep = simnet.callReadOnlyFn(JING, "get-token-x-deposit", [cycle, Cl.principal(probe)], D).result;
    const book = simnet.callReadOnlyFn(JING, "get-token-x-depositors", [cycle], D).result;
    console.log("  market records deposit      :", Cl.prettyPrint(dep));
    console.log("  depositors list             :", Cl.prettyPrint(book));
    console.log("  probe sBTC after make       :", bal());

    const cancel = simnet.callPublicFn("jing-probe", "cancel", [sbtc()], D);
    console.log("  contract cancels            :", Cl.prettyPrint(cancel.result));
    console.log("  probe sBTC after cancel     :", bal());

    expect(Cl.prettyPrint(fund.result)).toBe("(ok true)");
    expect(Cl.prettyPrint(make.result)).toMatch(/^\(ok /);
    expect(Cl.prettyPrint(dep)).toBe(`u${AMT}`);
    expect(Cl.prettyPrint(book)).toContain(probe);
    expect(Cl.prettyPrint(cancel.result)).toMatch(/^\(ok /);
    expect(bal()).toBe(`(ok u${AMT})`);
  });
});
