import { Cl } from "@stacks/transactions";
import { describe, expect, it, beforeEach } from "vitest";

const BF   = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const SBTC = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4";

const accounts = simnet.getAccounts();
const owner = accounts.get("wallet_1")!;
const agent = accounts.get("wallet_2")!;
const rando = accounts.get("wallet_3")!;

const pool = () => Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1");
const xTok = () => Cl.contractPrincipal(SBTC, "sbtc-token");
const yTok = () => Cl.contractPrincipal(BF, "token-stx-v-1-2");

const exec = (amount: number, sender: string) =>
  simnet.callPublicFn(
    "mandate-vault", "execute",
    [pool(), xTok(), yTok(), Cl.uint(amount), Cl.uint(1)],
    sender
  );

describe("mandate vault policy gate", () => {
  beforeEach(() => {
    simnet.callPublicFn(
      "mandate-vault", "grant",
      [Cl.principal(agent), Cl.uint(1_000_000), Cl.uint(9_999_999)],
      owner
    );
  });

  it("rejects a caller who holds no mandate", () => {
    const { result } = exec(1000, rando);
    expect(result).toBeErr(Cl.uint(100)); // ERR_NO_MANDATE
  });

  it("rejects an order above the per-trade notional cap", () => {
    const { result } = exec(2_000_000, agent);
    expect(result).toBeErr(Cl.uint(102)); // ERR_TOO_LARGE
  });

  it("rejects once the mandate has expired", () => {
    simnet.callPublicFn(
      "mandate-vault", "grant",
      [Cl.principal(agent), Cl.uint(1_000_000), Cl.uint(1)],
      owner
    );
    const { result } = exec(1000, agent);
    expect(result).toBeErr(Cl.uint(103)); // ERR_EXPIRED
  });

  it("passes policy and reaches Bitflow xyk-core through as-contract", { timeout: 180000 }, () => {
    const { result } = exec(1000, agent);
    const repr = Cl.prettyPrint(result);
    console.log("  in-policy call returned:", repr);
    // must NOT be one of our own policy errors -- that would mean it never left the vault
    expect(["(err u100)", "(err u101)", "(err u102)", "(err u103)"]).not.toContain(repr);
  });

  it("agent cannot withdraw -- withdraw pays the owner only", () => {
    const { result } = simnet.callPublicFn(
      "mandate-vault", "withdraw",
      [xTok(), Cl.uint(1)],
      agent
    );
    console.log("  agent withdraw returned:", Cl.prettyPrint(result));
    expect(Cl.prettyPrint(result)).toBe("(err u100)"); // no mandate keyed to the agent
  });
});
