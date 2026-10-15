# Structured review

The review behind D-008, in place of an external audit until the AUM cap rises: a threat model, invariant tests, an adversarial suite, static checks, and this log of what they found. It is an internal review, not an audit.

**Scope:** the contracts that go to mainnet, `contracts/mandate-vault-v5.clar`, `contracts/granite-venue.clar`, `contracts/venue-trait.clar` and `contracts/sip-010-trait.clar`, with the earlier versions where a finding began in them. Reviewed at `13a3fda`.

## Method

| Method | What it covers | Where | Result |
|---|---|---|---|
| Threat model | every attack and failure the contracts are meant to stop, each with the check that stops it and the test that shows it; and the risks they don't stop | `docs/SPEC.md`, section 4, groups A to I | each attack has a check and a test; residual risks are listed below |
| Line-by-line reading | each function against the specification, and every point where code the vault doesn't control runs while the vault's books are open | the two contracts above | R-001 |
| Adversarial suite (#30) | 58 attacks a delegate, the people around it, or a venue could make, each asserting the exact refusal, no asset events and no balance changed | `tests/v5-adversarial.test.ts` | all refused (E-029, E-035) |
| Invariant walks (#31) | 400 random steps per seed by two owners and two delegates across two venues, one calling back into the vault at random; after every step the books match the balances | `tests/v5-invariants.test.ts` | held on v5 over 74 seeds; on v4 every seed tried fails (E-033, E-035) |
| Real venues on a mainnet fork | the vault against Zest's sBTC vault and Granite's USDCx pool as deployed | `tests/v5-zest-fork.test.ts`, `tests/v5-granite-fork.test.ts` | books match real balances to the unit (E-011, E-028, E-035) |
| Static checks | Clarinet 3.24.1's type checks and lints on every manifest, and its taint analysis (`check_checker`) on the contracts that go to mainnet | `node scripts/static-check.mjs`, in CI | no errors; 64 warnings, each justified below |

## Severity

| Level | Meaning |
|---|---|
| Critical | someone can take another owner's funds, or the vault's books can exceed what it holds |
| High | a delegate or a stranger can act outside a mandate, or an owner's funds can be stranded or lost |
| Medium | a limit can be switched off or made to abort by a mistake in its parameters |
| Low | no funds at risk |
| Informational | a design choice, or a tool's warning, that stands for the reason given |

## Findings

| ID | Finding | Severity | Found by | Status | Fixed in, or why it stands |
|---|---|---|---|---|---|
| R-001 | v3 and v4 credit a venue's call back twice. While an owner unwinds, the vault credits them with everything its balance of the asset gained while the venue ran; a venue on that owner's own list that deposits its own tokens into the vault, as itself, from its `redeem` or the balance read after it, is credited for the deposit, and the owner is credited for the same tokens. Other owners' funds cover both (#48) | Critical | line-by-line reading | fixed in v5 | `13a3fda`: v5 is closed while `allocate`, `unwind` or `owner-unwind` runs, and every function that writes refuses (D-022, E-035) |
| R-002 | v3 identifies owners and delegates by `tx-sender`, so a contract an owner calls can act as the owner: one call allowlists the contract's venue, grants a mandate and allocates the owner's idle funds into it (#40) | High | threat modelling | fixed in v4 | `aa27bdf`: callers are identified by `contract-caller` (D-019, E-027) |
| R-003 | v3 as first written credited the amounts a venue reported rather than what arrived, so a buggy or hostile venue could inflate a position | High | hostile-venue tests | fixed before v3 was deployed | `c611095`: every venue call is bracketed by balance reads, and a mismatch is refused (D-011, E-012) |
| R-004 | Under v3's `tx-sender` rule, a venue calling back mid-call ran as the vault, so a mandate granted to the vault would let any venue act on it | High | hostile-venue tests | fixed before v3 was deployed | `c611095`: `grant` refuses the vault as a delegate (`u115`). Under v4's caller rule a call back runs as the venue instead, and v5 refuses it (D-011, E-012) |
| R-005 | `grant` accepted a zero-length rate window, which restarts on every call and so switches the rate limit off, and slippage limits above 100%, which make a later floor negative and abort `allocate` | Medium | review of the policy model's edge values | fixed in v3 | `830efcc`: `grant` refuses them (`u116`) before writing anything (E-016) |
| R-006 | The first vault kept one balance for all owners, and `withdraw` paid any owner with a mandate any amount, so one owner could withdraw everyone's funds | Critical | adversarial pass on the first vault | fixed in v2, before any deployment | `7553d8e`: idle balances per owner and token (E-007) |
| R-007 | The first vault resolved a delegate to its owner through one reverse map keyed by delegate, so any owner's `grant` could overwrite another owner's entry | High | adversarial pass on the first vault | fixed in v2 | `7553d8e`: mandates keyed by owner and delegate (E-007) |
| R-008 | The first vault's `withdraw` required a live mandate, so revoking one stranded the owner's funds | High | adversarial pass on the first vault | fixed in v2 | `7553d8e`: withdrawal depends only on the ledger (E-007) |
| R-009 | The first vault took the minimum output from the delegate, so it could trade at any price it chose | High | adversarial pass on the first vault | fixed in v2 | `7553d8e`: the floor comes from an on-chain quote (E-007) |
| R-010 | A draft of v2's asset and venue allowlists used global maps anyone could write, so a stranger could change a policy control that governed every mandate | High | adversarial pass, before v2's first commit | fixed before v2 was committed | `7553d8e` keys the lists by owner, and only that owner edits them; `fed0043` tests that a stranger's entry doesn't reach another owner (E-007) |
| R-011 | v3 and v4 stay deployed on testnet with R-001, and v3 with R-002 | Informational | | stands | testnet only, holding nothing of value; kept unchanged as the records of M1 and of M2's testnet runs. The deploy and run scripts now target v5 |
| R-012 | The cap bounds principal, deposits less withdrawals, not holdings, so yield can take the vault's holdings a little above it | Informational | | stands | D-018: the vault can read principal without trusting a venue's valuation |
| R-013 | The Granite adapter holds every owner's Granite LP tokens | Informational | | stands | D-020: Granite's pool burns LP tokens from its caller, so the vault can't hold them itself; the cap bounds what the adapter can hold |
| R-014 | Risks the contracts don't stop: a venue that pauses, loses funds or lies consistently in both its reports and its ledger; an owner's own choices of venue and limits; a compromised owner key; churn within the limits; rounding at venues; clock drift in Bitcoin blocks | Informational | threat modelling | stands | each is listed with its reason in `docs/SPEC.md`, section 4, "Residual risks" |
| R-015 | Clarinet raises 64 warnings across the contracts: lints and, on the mainnet contracts, its taint analysis | Informational | static checks | stands | none is a defect; each is justified below, and CI fails if one appears or goes without the table changing |
| R-016 | A mandate's notional limits count raw units of whichever asset moves. `allocate` compares the amount with `max-notional`, and adds it to the day's total checked against `max-daily-notional`, whatever the asset (`contracts/mandate-vault-v5.clar`, lines 234, 250 and 277). A mandate whose delegate moves assets with different decimals, such as sBTC (8) and USDCx (6), applies one number to very different values, and its daily total mixes them (#56) | Low | planning the live mandate (#35) | stands | each asset's cap still bounds what the vault holds, and the owner sets the limits. An owner who wants limits in each asset's own units grants one delegate per asset, each with its own mandate. Keying limits by asset would be a new version |

## Static analysis

`node scripts/static-check.mjs` runs `clarinet check` on `Clarinet.toml`, `Clarinet-local.toml`, `Clarinet-testnet.toml` and `Clarinet-review.toml`. All four check with no errors. `Clarinet-jing.toml` is left out: Jing's market contract, its requirement, names a Pyth contract that `clarinet check` can't resolve, though the Jing suite runs it on a fork. `Clarinet-review.toml` holds only the contracts that go to mainnet, with the taint analysis on. Its `callee_filter` option, which would count the checks inside a private function, stays off: on, Clarinet 3.24.1 reports a different set of warnings from run to run.

The script fails if Clarinet raises a warning this table doesn't list, at the lines listed, or if a row lists a warning Clarinet no longer raises. Line numbers are the warnings' first lines; a line appears once per warning.

| Contract | Check | Lines | Why it stands |
|---|---|---|---|
| `contracts/mandate-vault-v5.clar` | `check_checker` | 153, 158, 160, 162, 162, 164, 194, 194, 195, 196, 203, 219, 219, 219, 219, 219, 313, 313, 313, 313, 313, 339, 339, 339, 339, 339 | Inputs reaching the books. 153: `set-cap`, by the deployer only, once, never zero. 158 to 164: the allowlist functions, which write only the caller's own entries. 194 to 196: `grant`'s per-move cap, expiry, trade count and daily cap, where every value is a valid choice for the owner, written only under the caller's own key. 203: `revoke`, the caller's own entry. 219, 313 and 339: the public `allocate`, `unwind` and `owner-unwind` hand their inputs to `allocate-closed`, `unwind-closed` and `exit-position`, which check every one before anything is written, in the order `docs/SPEC.md` section 3 gives. The analysis doesn't follow checks into a private function |
| `contracts/mandate-vault-v5.clar` | `unnecessary_tuple` | 94, 98, 98, 99, 99, 101, 102 | Single-field map values and keys, a lint about cost rather than correctness. Flattening them would touch every read and write of the books, in what should be a minimal fix that diffs cleanly against the v4 tested on testnet |
| `contracts/mandate-vault-v4.clar` | `unnecessary_tuple` | 78, 82, 82, 83, 83, 85, 86 | As in v5. v4 is deployed on testnet, and its source stays identical to the deployment |
| `contracts/mandate-vault-v3.clar` | `unnecessary_tuple` | 55, 59, 60 | As in v5. v3 is deployed on testnet as M1's record |
| `contracts/mandate-vault-v2.clar` | `unnecessary_tuple` | 43, 46, 47 | Superseded, and kept with its tests |
| `contracts/mandate-vault.clar` | `unnecessary_tuple` | 16, 20, 20 | The first vault, superseded, and kept with its tests |
| `contracts/granite-venue.clar` | `check_checker` | 48, 55 | 48: `deposit` mints the shares to the recipient its caller names, and the caller pays for them. 55: `redeem` burns only the caller's own shares, and the burn fails if they aren't there |
| `contracts/granite-venue.clar` | `panic` | 31, 34 | `unwrap-panic` on `state-v1`'s and `usdcx`'s `get-balance`, which as deployed return `(ok (ft-get-balance ...))` and can't return an error. If one ever did, aborting would be right: a balance read as zero would mis-measure the shares minted |
| `contracts/mock-token.clar` | `unused_binding` | 8 | The test token's `transfer` ignores `memo`, which the SIP-010 signature requires |
| `contracts/mock-token-b.clar` | `unused_binding` | 9 | As `mock-token` |
| `contracts/phish-venue.clar` | `unused_binding` | 9, 16, 16, 16 | A test venue built to keep what it is given, so it ignores its arguments |
| `contracts/phish-venue.clar` | `unnecessary_public` | 16 | Its `redeem` only ever fails; it stays public to fit the venue trait |
| `contracts/phisher-v3.clar` | `panic` | 7, 8 | A test contract: v3's allowlist functions never return an error, so their error type is unknown and `try!` can't type-check |
| `contracts/reentrant-venue-v4.clar` | `panic` | 21 | A test contract, as `phisher-v3`, for v4's `allow-asset` |
| `contracts/reentrant-venue-v4.clar` | `unused_data_var` | 11 | A test contract: it keeps `reentrant-venue`'s `owner` setting so both take the same `arm` arguments, though its only calls don't need an owner |
