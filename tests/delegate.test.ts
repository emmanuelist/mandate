import { describe, expect, it } from "vitest";
// @ts-ignore: a plain ES module, without type declarations
import { decide } from "../scripts/delegate.mjs";

// The reference delegate's decisions (#33): what it does from what it can read.
const mandate = { maxNotional: 20_000n, expires: 1_000n, maxSlipBps: 100n, maxTrades: 10n, windowLen: 144n, maxDaily: 200_000n };
const counters = { windowStart: 0n, windowCount: 0n, dayStart: 0n, dayNotional: 0n };
const s = (o: Record<string, unknown> = {}) => ({ burn: 100n, mandate, counters, idle: 40_000n, shares: 0n, value: 0n, ...o });

describe("the reference delegate's decisions", () => {
  it("delegate: allocates toward the target, no more than the per-move cap", () => {
    expect(decide(s(), 7500)).toMatchObject({ action: "allocate", amount: 20_000n });
  });
  it("delegate: unwinds toward a lower target", () => {
    expect(decide(s({ idle: 10_000n, shares: 30_000n, value: 30_000n }), 2500)).toMatchObject({ action: "unwind", shares: 20_000n });
  });
  it("delegate: holds within 1% of the target", () => {
    expect(decide(s({ idle: 20_000n, shares: 20_000n, value: 20_100n }), 5000).action).toBe("hold");
  });
  it("delegate: stops without a mandate, or once it has expired", () => {
    expect(decide(s({ mandate: null }), 7500).action).toBe("stop");
    expect(decide(s({ burn: 1_000n }), 7500).action).toBe("stop");
  });
  it("delegate: waits when the rate window is used up, and acts again once it lapses", () => {
    const used = { ...counters, windowCount: 10n };
    expect(decide(s({ counters: used }), 7500).action).toBe("wait");
    expect(decide(s({ counters: used, burn: 144n }), 7500).action).toBe("allocate");
  });
  it("delegate: never allocates past what is left of the day's notional", () => {
    expect(decide(s({ counters: { ...counters, dayNotional: 195_000n } }), 7500)).toMatchObject({ action: "allocate", amount: 5_000n });
    expect(decide(s({ counters: { ...counters, dayNotional: 200_000n } }), 7500).action).toBe("hold");
  });
});
