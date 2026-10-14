# Mandate protocol specification

Covers `contracts/mandate-vault-v3.clar` and `contracts/venue-trait.clar`. Every limit here is enforced by the contract; nothing depends on an off-chain service. `node scripts/spec-crosscheck.mjs` fails if a test in the v3 suites isn't named in this document, and CI runs it.

## 1. Roles and assets

- **Owner:** deposits assets, sets their own allowlists and mandates, and can always withdraw and unwind their own positions.
- **Delegate:** a principal the owner grants a mandate. It can move that owner's funds between the owner's idle balance and the owner's allowlisted venues, and nothing else.
- **Venue:** a contract with the venue trait's shape (`convert-to-shares`, `convert-to-assets`, `deposit`, `redeem`, `get-balance`). Zest's v0 vaults satisfy it as deployed (D-009).
- **Assets:** SIP-010 tokens. Native STX is not supported.

One contract holds every owner's funds, with separate books per owner.

## 2. Policy model

### State

| Map | Key | Value |
|---|---|---|
| `balances` | owner, token | idle amount |
| `positions` | owner, venue | shares held by the vault, and the asset they unwind to |
| `allowed-asset` | owner, token | listed or not |
| `allowed-venue` | owner, venue | the asset that venue takes |
| `mandates` | owner, delegate | the parameters below |
| `counters` | owner, delegate | window start and count, day start and total, cumulative slippage |

### Mandate parameters

| Parameter | Meaning | Edge behaviour |
|---|---|---|
| `max-notional` | the largest single allocation, in asset units | 0 allows no allocation |
| `expires` | a Bitcoin block height; calls at or after it are refused | a past height makes the mandate inert |
| `max-slip-bps` | the largest shortfall against the venue's quote in one move, in basis points | 10,000 sets the floor to zero; above 10,000 is refused by `grant` (`u116`) |
| `max-trades-per-window`, `window-len` | at most that many allocations and unwinds per window of `window-len` Bitcoin blocks | `window-len` 0 would restart the window on every call, so `grant` refuses it (`u116`) |
| `max-daily-notional` | total allocated per day of 144 Bitcoin blocks; unwinds don't count | 0 allows no allocation |
| `max-cum-slip-bps` | the summed shortfall across moves, adding each move's basis points regardless of its size | 0 allows only fills at the quote; above 10,000 is refused by `grant` (`u116`) |

Windows and days roll forward on the first call after they lapse. **`grant` resets every counter**, including the cumulative slippage, so re-granting gives a delegate a fresh budget.

## 3. Authorization flow

### Who can call what

| Function | Caller | Mandate needed | Effect |
|---|---|---|---|
| `allow-asset`, `disallow-asset`, `allow-venue`, `disallow-venue` | anyone | no | edits the caller's own lists only |
| `deposit (token amount)` | owner | no | asset must be on the caller's list (`u106`); credits the caller |
| `grant (delegate ...)` | owner | no | refuses the vault itself as a delegate (`u115`) and parameters that would switch a limit off or abort later (`u116`); resets counters |
| `revoke (delegate)` | owner | no | deletes the mandate |
| `withdraw (token amount)` | owner | no | pays the caller from the caller's idle balance (`u105`) |
| `allocate (owner venue asset amount)` | delegate | yes | moves idle assets into a venue |
| `unwind (owner venue asset shares)` | delegate | yes | brings shares back to idle |
| `owner-unwind (venue asset shares min-out)` | owner | no | brings the owner's own shares back to idle |

### `allocate`, in order

Identity and policy are answered before state, so an exhausted mandate reports its policy error even when the balance is also short.

1. A mandate exists for (owner, caller), else `u100`.
2. The asset is on the owner's list, else `u106`.
3. The venue is on the owner's list for this asset, else `u107`.
4. An open position at this venue holds the same asset, else `u107`.
5. The amount is at most `max-notional`, else `u102`.
6. The burn height is before `expires`, else `u103`.
7. The window count is below `max-trades-per-window`, else `u110`.
8. The day's total plus the amount is at most `max-daily-notional`, else `u111`.
9. The owner's idle balance covers the amount, else `u105`.
10. The venue quotes a positive number of shares (`convert-to-shares`), else `u109`. The floor is that quote less `max-slip-bps`.
11. The idle balance is debited, and the vault's asset and share balances are read.
12. The venue's `deposit` is called with the floor as its minimum, under an `as-contract?` allowance of exactly the amount. A venue taking more fails the call with `(err u0)`.
13. The balances are read again. Exactly the amount must have left (`u114`), the shares received must be at least what the venue reported (`u114`), and at least the floor (`u108`).
14. The shortfall against the quote is added to the cumulative slippage, which must stay within `max-cum-slip-bps` (`u112`).
15. The counters are updated and the position is credited with the shares actually received.

### `unwind` and `owner-unwind`

`unwind` checks the mandate (`u100`), expiry (`u103`), the rate window (`u110`) and the position (`u113`), then takes a quote (`convert-to-assets`, `u109`) and sets the floor from `max-slip-bps`. It doesn't touch the per-move or daily caps, since unwinding reduces exposure.

Both then exit the position the same way: the position must exist and hold the asset given (`u113`, `u106`), and the shares must be between 1 and the position (`u113`). The position is debited, the balances are read, and the venue's `redeem` is called under an allowance of exactly those shares. Exactly those shares must have been burned (`u114`), the assets received must be at least what the venue reported (`u114`) and at least the minimum (`u108`), and the owner's idle balance is credited with what actually arrived.

`unwind` then adds its shortfall to the cumulative slippage (`u112`) and counts against the window. `owner-unwind` uses the owner's own minimum and has no mandate, window or budget.

### Error codes

| Code | Meaning |
|---|---|
| `u0` | an `as-contract?` allowance was exceeded: the venue tried to move more than the call allowed |
| `u100` | no mandate for (owner, caller) |
| `u102` | above the per-move cap |
| `u103` | mandate expired |
| `u105` | idle balance too low |
| `u106` | asset not listed, or not the position's asset |
| `u107` | venue not listed for this asset, or the position holds another asset |
| `u108` | below the floor or the minimum |
| `u109` | the venue's quote was zero, or a venue read failed |
| `u110` | rate window exhausted |
| `u111` | daily cap exceeded |
| `u112` | cumulative slippage budget exceeded |
| `u113` | no such position, or more shares than it holds |
| `u114` | the venue's report doesn't match what the vault measured |
| `u115` | the vault can't be its own delegate |
| `u116` | a mandate parameter would switch a limit off or abort later |

A venue's own errors pass through unchanged, such as a venue refusing a deposit below its minimum.

## 4. Threat model

### Trust assumptions

- A Clarity contract can't change after deployment, and the vault has no admin, pause or upgrade path.
- An owner chooses their venues. A venue answers for its own share ledger (`get-balance`), so a venue on an owner's list is trusted that far, and no further.
- Time is Bitcoin block height.

### Attacks and the checks that stop them

**A. The delegate oversteps its mandate**

| Attack or failure | Stopped by | Test |
|---|---|---|
| A caller with no mandate from this owner tries to move the owner's funds | `allocate`: no mandate for (owner, caller), `u100` | "refuses a caller with no mandate" (v3.test.ts) |
| One oversized allocation | `allocate`: amount above `max-notional`, `u102` | "refuses a move above the per-move cap" (v3.test.ts) |
| A delegate acting after the mandate ran out | `allocate`, `unwind`: burn height at or past `expires`, `u103` | "refuses once the mandate has expired" (v3.test.ts) |
| Allocating an asset the owner never approved | `allocate`: asset not on the owner's list, `u106` | "refuses an asset the owner hasn't allowlisted" (v3.test.ts) |
| Allocating into a venue the delegate controls | `allocate`: venue not on the owner's list, `u107` | "refuses a venue the owner hasn't allowlisted" (v3.test.ts) |
| Pairing an approved venue with an asset it wasn't approved for | `allocate`: venue listed for another asset, `u107` | "refuses a venue allowlisted for a different asset" (v3.test.ts) |
| Churning: many moves that burn fees without changing the position | `allocate`, `unwind`: window count at `max-trades-per-window`, `u110` | "refuses when the rate window is exhausted" (v3.test.ts) |
| Slow-drip churn under the per-move cap | `allocate`: day's total would pass `max-daily-notional`, `u111` | "refuses a move that would exceed the day's notional" (v3.test.ts) |
| Moving more than the owner has idle | `allocate`: idle balance below the amount, `u105` | "refuses a move larger than the owner's idle balance" (v3.test.ts) |
| Probing state through policy errors | `allocate` answers identity and policy before balances: an exhausted mandate reports `u110`, not `u105` | "answers policy before state: the rate limit beats an empty balance" (v3.test.ts) |
| Accepting a bad price on the owner's behalf | `allocate`: the floor comes from the venue's own quote, not the caller; a venue enforcing it refuses, and the vault checks shares against it, `u108` | "refuses a fill worse than the mandate's slippage, and nothing moves" (v3.test.ts); "testnet sBTC: a fill below the slippage floor is refused, and nothing moves" (sbtc-testnet.fork.ts) |
| Grinding the position down through many small bad fills | `allocate`, `unwind`: summed shortfall past `max-cum-slip-bps`, `u112` | "stops repeated small bleeds with the cumulative budget" (v3.test.ts) |
| A stranger grants an owner's delegate a mandate to reach that owner's funds | mandates are keyed by (owner, delegate); `allocate` reads only the named owner's mandate, `u102` here | "a stranger can't redirect another owner's delegate" (v3.test.ts) |
| The delegate pulling funds out | `withdraw` pays only the caller's own idle balance; the delegate has none, `u105` | "the delegate can't withdraw" (v3.test.ts) |

**B. Funds stranded**

| Attack or failure | Stopped by | Test |
|---|---|---|
| Revoking a delegate locks funds in a venue | `owner-unwind` and `withdraw` need no mandate; the revoked delegate gets `u100` | "revoking can't strand funds: the owner unwinds and withdraws without a mandate" (v3.test.ts) |
| An expired mandate locks funds in a venue | `owner-unwind` needs no mandate; the expired delegate gets `u103` | "expiry can't strand funds either" (v3.test.ts) |
| Removing a venue from the list locks the position in it | `allocate` checks the list (`u107`); `unwind` checks only the position | "disallowing a venue stops new allocations but not unwinding" (v3.test.ts) |
| The same, against Zest's real sBTC vault | `owner-unwind`, `withdraw` | "the owner exits Zest without a mandate after revoking, then withdraws" (v3-zest-fork.test.ts) |
| The same after expiry, against Zest | `owner-unwind` | "the owner exits Zest after the mandate expires" (v3-zest-fork.test.ts) |

**C. Owners' books mixing**

| Attack or failure | Stopped by | Test |
|---|---|---|
| An owner withdrawing someone else's deposit | idle balances are kept per (owner, token), `u105` | "one owner can't withdraw another owner's deposit" (v3.test.ts) |
| A stranger writing an owner's allowlist | lists are keyed by owner and only the caller's own can be edited; `u106` here | "allowlists are per owner: mallory's entries don't reach alice's mandate" (v3.test.ts) |
| Re-declaring a venue's asset so a position unwinds into the wrong asset | `allocate`: an open position's asset must match, `u107` | "a position keeps the asset it was opened with" (v3.test.ts) |
| Unwinding shares that belong to other owners | `unwind`, `owner-unwind`: shares above the position, `u113` | "the delegate can't unwind more than the position" (v3.test.ts) |
| Crediting an unwind in the wrong asset | exit checks the asset against the position, `u106` | "unwinding with an asset other than the position's is refused" (v3.test.ts) |
| An owner unwinding someone else's position | positions are keyed by (owner, venue), `u113` | "the owner can't unwind another owner's position" (v3.test.ts) |

**D. A hostile venue**

| Attack or failure | Stopped by | Test |
|---|---|---|
| A venue pulls more than the move from the vault | the `as-contract?` allowance is exactly the move; the call fails with `(err u0)` | "takes more than the move: stopped by the allowance, nothing moves" (v3-hostile.test.ts) |
| A venue reports more shares than it delivered | balances are read before and after; reported above received, `u114` | "reports more shares than it mints: refused" (v3-hostile.test.ts) |
| A venue calls back into the vault during a deposit | the callback runs as the vault, which owns no balances, positions or mandates; it fails, `u105` here | "calls back into the vault mid-call: refused" (v3-hostile.test.ts) |
| A callback running as the vault acts on a mandate granted to the vault | `grant` refuses the vault as a delegate, `u115` | "the vault can't be granted as its own delegate, so a callback can't act on a mandate" (v3-hostile.test.ts) |
| A venue reports more assets than it paid | balances are read before and after; reported above received, `u114` | "pays less than it reports on redeem: refused, for the delegate and the owner" (v3-hostile.test.ts) |
| A venue burns more of the vault's shares than asked, eating another owner's position | the allowance is exactly the shares asked; `(err u0)`; the burn is also measured, `u114` | "burns more shares than asked: refused, and another owner's shares are safe" (v3-hostile.test.ts) |

**E. A real venue: Zest**

| Attack or failure | Stopped by | Test |
|---|---|---|
| Any of group A against Zest's real sBTC vault | the same checks, which run before the venue is called | "policy refusals hold with Zest as the venue, and nothing leaves the vault" (v3-zest-fork.test.ts) |
| Using Zest when the owner hasn't listed it, or listed it for another asset, or acting without a mandate | `u107`, `u107`, `u100` | "refuses Zest unless the owner allowlisted it, for sBTC" (v3-zest-fork.test.ts) |

**F. Bad mandate parameters**

| Attack or failure | Stopped by | Test |
|---|---|---|
| A zero-length window that restarts on every call, switching the rate limit off | `grant`, `u116` | "grant refuses a zero-length rate window, which would switch the rate limit off" (v3.test.ts) |
| Per-move slippage above 100%, which would make the floor negative and abort `allocate` | `grant`, `u116` | "grant refuses per-move slippage above 100%" (v3.test.ts) |
| A slippage budget above 100% | `grant`, `u116` | "grant refuses a slippage budget above 100%" (v3.test.ts) |
| A refused grant overwriting a working mandate | the checks run before anything is written | "a refused grant leaves the existing mandate in force" (v3.test.ts) |
| The guards refusing valid edge values | a one-block window and 100% slippage are accepted | "grant accepts the boundaries: a one-block window and 100% slippage" (v3.test.ts) |

### Residual risks: not stopped by the contract

- **A venue that pauses, loses funds or fails.** The owner bears venue risk, and a paused venue blocks unwinding until it resumes.
- **A venue that lies consistently**, in both its `deposit` result and its own `get-balance`. The owner's allowlist is the anchor.
- **An owner's own choices:** listing a hostile venue, or granting wide limits.
- **A compromised owner key**, which controls that owner's books entirely.
- **Churn within the limits.** The rate window, daily cap and cumulative budget bound it; they don't prevent it.
- **Rounding at venues.** A 100,000-sat round trip through Zest returns 99,999 (E-011).
- **Clock drift.** Windows and days count Bitcoin blocks, so their length in hours varies.

## 5. Non-goals

- **No price oracle.** Slippage is measured against the venue's own on-chain quote, and the cumulative budget stands in for drawdown.
- **No withdrawal or transfer by the delegate.** It can only move an owner's funds between that owner's idle balance and the owner's venues.
- **No admin, pause or upgrade.** A new version is a new contract.
- **No per-delegate venue lists.** An owner's lists apply to all of that owner's delegates.
- **No native STX**, which would need a `with-stx` allowance.
- **No swaps on DEXs** (D-002).
- **No per-vault AUM cap yet.** It comes before mainnet, in M2.

## Lifecycle tests

These show the vault working rather than refusing an attack.

- "allocates idle assets into the venue, unwinds them, and the owner withdraws everything" (v3.test.ts)
- "control: the same venue behaving honestly passes every check" (v3-hostile.test.ts)
- "deposit, allocate, unwind, withdraw: every sat accounted for" (v3-zest-fork.test.ts)
- "a zero-slippage mandate still allocates, because Zest fills at its quote" (v3-zest-fork.test.ts)
- "testnet sBTC: deposit, allocate, unwind, withdraw, every sat accounted for" (sbtc-testnet.fork.ts)
