import { describe, expect, it } from "vitest";
// @ts-ignore: a plain ES module, without type declarations
import { attemptOf, decide } from "../scripts/delegate.mjs";

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

// The calls the delegate makes for the record of refusals (#36): each one the
// mandate forbids, with the code the vault must refuse it with.
const cfg = { venue: "ST1.venue", asset: "ST1.token", unlistedVenue: "ST1.other-venue" };
describe("the delegate's out-of-policy attempts", () => {
  it("attempt: one over the per-move cap, refused with u102", () => {
    expect(attemptOf("over-cap", s(), cfg)).toMatchObject({ fn: "allocate", venue: "ST1.venue", amount: 20_001n, expect: 102 });
  });
  it("attempt: a venue the owner never listed, refused with u107", () => {
    expect(attemptOf("unlisted-venue", s(), cfg)).toMatchObject({ fn: "allocate", venue: "ST1.other-venue", amount: 1n, expect: 107 });
    expect(() => attemptOf("unlisted-venue", s(), { ...cfg, unlistedVenue: undefined })).toThrow(/unlistedVenue/);
  });
  it("attempt: a withdrawal, refused with u105", () => {
    expect(attemptOf("withdraw", s(), cfg)).toMatchObject({ fn: "withdraw", amount: 1n, expect: 105 });
  });
  it("attempt: a move after the owner revokes, refused with u100, and only once the mandate is gone", () => {
    expect(attemptOf("revoked", s({ mandate: null }), cfg)).toMatchObject({ fn: "allocate", amount: 1n, expect: 100 });
    expect(() => attemptOf("revoked", s(), cfg)).toThrow(/revoke the mandate first/);
    expect(() => attemptOf("over-cap", s({ mandate: null }), cfg)).toThrow(/live mandate/);
    expect(() => attemptOf("sideways", s(), cfg)).toThrow(/unknown attempt/);
  });
});
