import { Cl } from "@stacks/transactions";
import { describe, it } from "vitest";
const SBTC  = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1";
const dep = simnet.deployer;
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const P = "mandate-probe-mainnet";

// Floor is 2 sats. 1 sat rounds to zero shares and trips Zest ERR-SLIPPAGE (u801010).
//   1 -> (err u801010)   2 -> (ok u1)   10 -> (ok u9)   100 -> (ok u99)
describe("what is the smallest amount that actually works?", () => {
  it("walks the size down to find the floor", () => {
    for (const amt of [1000, 500, 100, 10, 1]) {
      simnet.callPublicFn(P, "fund", [xTok(), Cl.uint(amt)], WHALE);
      const al = simnet.callPublicFn(P, "allocate", [Cl.uint(amt), Cl.uint(1)], dep);
      const a = Cl.prettyPrint(al.result);
      let line = `  ${String(amt).padStart(5)} sats -> allocate ${a}`;
      const shares = Number(a.match(/^\(ok u(\d+)\)$/)?.[1] ?? 0);
      if (shares > 0) {
        const un = simnet.callPublicFn(P, "unwind", [Cl.uint(shares), Cl.uint(1)], dep);
        const u = Cl.prettyPrint(un.result);
        const back = Number(u.match(/^\(ok u(\d+)\)$/)?.[1] ?? 0);
        line += ` | unwind ${u}`;
        if (back > 0) {
          const rs = simnet.callPublicFn(P, "rescue", [xTok(), Cl.uint(back)], dep);
          line += ` | rescue ${Cl.prettyPrint(rs.result)}`;
        }
      }
      console.log(line);
    }
  });
});
