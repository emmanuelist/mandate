import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const BF = "SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR";
const a = simnet.getAccounts();
const dep = simnet.deployer;
const alice = a.get("wallet_1")!, bob = a.get("wallet_2")!, agentX = a.get("wallet_3")!;
const V = "mandate-vault-v2";
const MOCK = `${dep}.mock-token`;

const mock = () => Cl.contractPrincipal(dep, "mock-token");
const pool = () => Cl.contractPrincipal(BF, "xyk-pool-sbtc-stx-v-1-1");
const yTok = () => Cl.contractPrincipal(BF, "token-stx-v-1-2");

const bal = (who: string) =>
  Cl.prettyPrint(simnet.callReadOnlyFn(V, "balance-of",
    [Cl.principal(who), Cl.principal(MOCK)], who).result);

function setup() {
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(alice)], dep);
  simnet.callPublicFn("mock-token", "mint", [Cl.uint(1_000_000), Cl.principal(bob)], dep);
  simnet.callPublicFn(V, "allow-asset", [mock()], alice);
  simnet.callPublicFn(V, "allow-asset", [yTok()], alice);
  simnet.callPublicFn(V, "allow-venue", [pool()], alice);
}

// (agent, maxNotional, expires, slipBps, tradesPerWindow, windowLen, dailyNotional, cumSlipBps)
const grant = (o: string, ag: string, opts: Partial<{cap:number;trades:number;daily:number}> = {}) =>
  simnet.callPublicFn(V, "grant", [
    Cl.principal(ag), Cl.uint(opts.cap ?? 500_000), Cl.uint(9_999_999), Cl.uint(100),
    Cl.uint(opts.trades ?? 100), Cl.uint(144),
    Cl.uint(opts.daily ?? 10_000_000), Cl.uint(10_000),
  ], o);

describe("ledger accounting (real balances via mock SIP-010)", () => {
  it("deposit credits the depositor, and only the depositor", () => {
    setup();
    simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(400_000)], alice);
    console.log("  alice ledger:", bal(alice), " bob ledger:", bal(bob));
    expect(bal(alice)).toBe("u400000");
    expect(bal(bob)).toBe("u0");
  });

  it("one owner cannot withdraw another owner's deposit", () => {
    setup();
    simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(400_000)], alice);
    const r = simnet.callPublicFn(V, "withdraw", [mock(), Cl.uint(400_000)], bob);
    console.log("  bob withdrawing alice's 400k:", Cl.prettyPrint(r.result));
    expect(r.result).toBeErr(Cl.uint(105));            // ERR_BALANCE -- bob has none
    expect(bal(alice)).toBe("u400000");                // alice untouched
  });

  it("withdraw debits the ledger and returns the tokens", () => {
    setup();
    simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(400_000)], alice);
    const r = simnet.callPublicFn(V, "withdraw", [mock(), Cl.uint(150_000)], alice);
    console.log("  withdraw 150k:", Cl.prettyPrint(r.result), "-> ledger", bal(alice));
    expect(r.result).toBeOk(Cl.bool(true));
    expect(bal(alice)).toBe("u250000");
  });
});

describe("policy engine: rate limit and daily cap", () => {
  it("rate limit refuses the trade when the window is exhausted", () => {
    setup();
    simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(400_000)], alice);
    grant(alice, agentX, { trades: 0 });               // no trades permitted at all
    const r = simnet.callPublicFn(V, "execute",
      [Cl.principal(alice), pool(), mock(), yTok(), Cl.uint(1000)], agentX);
    console.log("  execute with 0 trades/window:", Cl.prettyPrint(r.result));
    expect(r.result).toBeErr(Cl.uint(110));            // ERR_RATE
  });

  it("daily cap refuses a trade that would exceed the day's notional", () => {
    setup();
    simnet.callPublicFn(V, "deposit", [mock(), Cl.uint(400_000)], alice);
    grant(alice, agentX, { daily: 500 });              // day budget below the order
    const r = simnet.callPublicFn(V, "execute",
      [Cl.principal(alice), pool(), mock(), yTok(), Cl.uint(1000)], agentX);
    console.log("  execute 1000 against a 500 daily cap:", Cl.prettyPrint(r.result));
    expect(r.result).toBeErr(Cl.uint(111));            // ERR_DAILY
  });

  it("policy is answered before state: rate limit beats an empty balance", () => {
    setup();
    grant(alice, agentX, { trades: 0 });               // no deposit at all
    const r = simnet.callPublicFn(V, "execute",
      [Cl.principal(alice), pool(), mock(), yTok(), Cl.uint(1000)], agentX);
    console.log("  no funds AND no rate budget:", Cl.prettyPrint(r.result));
    expect(r.result).toBeErr(Cl.uint(110));            // ERR_RATE, not ERR_BALANCE
  });
});
