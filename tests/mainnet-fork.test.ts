import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const BF   = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const a = simnet.getAccounts();
const alice = a.get("wallet_1")!;

const pool = () => Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1");
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const yTok = () => Cl.contractPrincipal(BF, "token-stx-v-1-2");

describe("mainnet fork -- real pool state, no wallet, no broadcast", () => {
  it("resolves the real sBTC/STX pool and returns a live quote", { timeout: 180000 }, () => {
    const r = simnet.callPublicFn(
      `${BF}.xyk-core-v-1-2`, "get-dy",
      [pool(), xTok(), yTok(), Cl.uint(100_000)], alice
    );
    const repr = Cl.prettyPrint(r.result);
    console.log("  get-dy(100000 sats sBTC) ->", repr);
    // in plain simnet this was (err u1012) ERR_INVALID_POOL: registry empty.
    // against forked mainnet state the pool must resolve and quote.
    expect(repr).not.toBe("(err u1012)");
  });

  it("reads live reserves from the pool contract", { timeout: 180000 }, () => {
    const r = simnet.callReadOnlyFn(
      `${BF}.xyk-pool-sbtc-stx-v-1-1`, "get-pool", [], alice
    );
    const s = Cl.prettyPrint(r.result);
    const xb = s.match(/x-balance:\s*(u\d+)/)?.[1];
    const yb = s.match(/y-balance:\s*(u\d+)/)?.[1];
    console.log("  live pool reserves -> x:", xb, " y:", yb);
    expect(xb).toBeDefined();
    expect(Number(xb!.slice(1))).toBeGreaterThan(0);
  });
});
