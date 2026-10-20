import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

// Bitflow's pools assert (is-standard recipient) before paying out. is-standard is a
// network check, true for any principal of the current network, contracts included, so
// on mainnet a contract receives a swap's output (#58, E-040). This fork runs mainnet's
// state, but the simulator deploys a project's contracts from its testnet-format address,
// which fails that check. The same probe, deployed from that address's mainnet form,
// swaps; deployed from the testnet form, it is refused with u3003, which E-003 once read
// as Bitflow refusing contracts.
const BF = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";
const WHALE = "SM2RRFN4HXTS7EYP8MHHYKSTG118S3HKGDV8AB8M1"; // a real sBTC holder on mainnet
const ST_FORM = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"; // the simulator's deployer
const SP_FORM = "SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRCBGD7R"; // the same key, mainnet form
const AMOUNT = 100_000; // sats
// swaps its own sBTC for STX through Bitflow's xyk core, as any contract would
const PROBE = `(use-trait xyk-pool '${BF}.xyk-pool-trait-v-1-2.xyk-pool-trait)
(use-trait ft '${BF}.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(define-read-only (standard (p principal)) (is-standard p))
(define-public (swap (pool <xyk-pool>) (x <ft>) (y <ft>) (amount uint))
  (as-contract (contract-call? '${BF}.xyk-core-v-1-2 swap-x-for-y pool x y amount u1)))`;
const pp = (r: any) => Cl.prettyPrint(r);

function swapFrom(deployer: string) {
  const probe = `${deployer}.bitflow-probe`;
  expect(simnet.deployContract("bitflow-probe", PROBE, { clarityVersion: 3 }, deployer).result).toBeBool(true);
  expect(simnet.callPublicFn(`${SBTC}.sbtc-token`, "transfer",
    [Cl.uint(AMOUNT), Cl.principal(WHALE), Cl.principal(probe), Cl.none()], WHALE).result).toBeOk(Cl.bool(true));
  const standard = pp(simnet.callReadOnlyFn(probe, "standard", [Cl.principal(probe)], WHALE).result);
  const r = simnet.callPublicFn(probe, "swap", [Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1"),
    Cl.contractPrincipal(SBTC, "sbtc-token"), Cl.contractPrincipal(BF, "token-stx-v-1-2"), Cl.uint(AMOUNT)], WHALE);
  const paid = r.events.filter((e: any) => e.event === "stx_transfer_event").map((e: any) => ({ to: e.data.recipient, amount: e.data.amount }));
  console.log(`  ${deployer.slice(0, 5)}... probe: is-standard ${standard} | swap ${pp(r.result)} | paid ${JSON.stringify(paid)}`);
  return { probe, standard, result: r.result, paid };
}

describe("Bitflow pays a contract; the fork's testnet-format deployer fails its network check", () => {
  it("bitflow: a contract deployed from a mainnet address receives a swap's output", { timeout: 300000 }, () => {
    const s = swapFrom(SP_FORM);
    expect(s.standard).toBe("true");
    const out = pp(s.result).match(/^\(ok u(\d+)\)$/)?.[1];
    expect(out, "the swap's output").toBeDefined();
    expect(s.paid).toEqual([{ to: s.probe, amount: out }]);
  });
  it("bitflow: the same contract deployed from the fork's testnet-format address is refused with u3003", { timeout: 300000 }, () => {
    const s = swapFrom(ST_FORM);
    expect(s.standard).toBe("false");
    expect(s.result).toBeErr(Cl.uint(3003));
    expect(s.paid).toEqual([]);
  });
});
