import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";
const BF="SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const a=simnet.getAccounts();
const alice=a.get("wallet_1")!, mallory=a.get("wallet_2")!;
const V="mandate-vault-v2";

describe("FIXED: allowlists are per-owner, a stranger cannot touch yours", () => {
  it("mallory allowlisting a venue does not affect alice", () => {
    const before = simnet.callReadOnlyFn(V, "venue-ok",
      [Cl.principal(alice), Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1")], alice);
    console.log("  alice venue allowed before        :", Cl.prettyPrint(before.result));

    // mallory is not alice, owns nothing, has no mandate
    const r = simnet.callPublicFn(V, "allow-venue",
      [Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1")], mallory);
    console.log("  mallory calls allow-venue         :", Cl.prettyPrint(r.result));

    const after = simnet.callReadOnlyFn(V, "venue-ok",
      [Cl.principal(alice), Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1")], alice);
    console.log("  alice venue allowed after        :", Cl.prettyPrint(after.result));

    // the allowlist governs EVERY mandate, so this affects alice's policy
    // mallory's call succeeds, but only writes HER OWN allowlist
    expect(Cl.prettyPrint(r.result)).toBe("(ok true)");
    expect(Cl.prettyPrint(after.result)).toBe("false");   // alice untouched
  });
});
