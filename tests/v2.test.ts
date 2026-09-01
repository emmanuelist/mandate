import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const BF   = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const a = simnet.getAccounts();
const alice = a.get("wallet_1")!, mallory = a.get("wallet_2")!, agentX = a.get("wallet_3")!;
const V = "mandate-vault-v2";

const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const yTok = () => Cl.contractPrincipal(BF, "token-stx-v-1-2");
const pool = () => Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1");

const grant = (o: string, ag: string, cap: number) =>
  simnet.callPublicFn(V, "grant",
    [Cl.principal(ag), Cl.uint(cap), Cl.uint(9_999_999), Cl.uint(100),
     Cl.uint(100), Cl.uint(144), Cl.uint(10_000_000_000), Cl.uint(10_000)], o);

const allowAll = () => {
  simnet.callPublicFn(V, "allow-asset", [Cl.contractPrincipal(SBTC, "sbtc-token")], alice);
  simnet.callPublicFn(V, "allow-asset", [Cl.contractPrincipal(BF, "token-stx-v-1-2")], alice);
  simnet.callPublicFn(V, "allow-venue", [Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1")], alice);
};

describe("v2 -- the three findings are closed", () => {
  it("FIX: revoking no longer strands funds (withdraw is ledger-gated, not mandate-gated)", () => {
    grant(alice, agentX, 1_000_000);
    simnet.callPublicFn(V, "revoke", [Cl.principal(agentX)], alice);
    const r = simnet.callPublicFn(V, "withdraw", [xTok(), Cl.uint(1)], alice);
    const repr = Cl.prettyPrint(r.result);
    console.log("  withdraw after revoke:", repr);
    expect(repr).toBe("(err u105)");           // ERR_BALANCE -- about funds, not permission
    expect(repr).not.toBe("(err u100)");       // no longer ERR_NO_MANDATE
  });

  it("FIX: a stranger cannot redirect another owner's agent", () => {
    allowAll();
    grant(alice, agentX, 1_000_000);
    grant(mallory, agentX, 999_999_999);       // mallory grants the same agent a huge cap
    // agentX tries to spend 50M against ALICE's vault
    const r = simnet.callPublicFn(V, "execute",
      [Cl.principal(alice), pool(), xTok(), yTok(), Cl.uint(50_000_000)], agentX);
    const repr = Cl.prettyPrint(r.result);
    console.log("  agentX spending 50M of alice (cap 1M):", repr);
    expect(repr).toBe("(err u102)");           // ERR_TOO_LARGE -- alice's cap binds again
  });

  it("FIX: the agent can no longer choose its own slippage floor", () => {
    const fns = (simnet.getContractsInterfaces()
      .get(`${simnet.deployer}.${V}`)?.functions ?? []) as any[];
    const exec = fns.find((f) => f.name === "execute");
    const args = exec.args.map((x: any) => x.name);
    console.log("  v2 execute args:", JSON.stringify(args));
    expect(args).not.toContain("min-dy");      // derived on-chain from get-dy instead
  });

  it("FIX: unlisted assets are refused", () => {
    grant(alice, agentX, 1_000_000);
    const r = simnet.callPublicFn(V, "execute",
      [Cl.principal(alice), pool(), xTok(), yTok(), Cl.uint(1000)], agentX);
    console.log("  execute with no allowlist entry:", Cl.prettyPrint(r.result));
    expect(Cl.prettyPrint(r.result)).toBe("(err u106)"); // ERR_ASSET
  });
});
