# State
_Last verified: 2026-10-13 at `1100249`_

**Thesis:** an owner can put someone else in charge of their sBTC without handing over the keys. The delegate moves funds between allowlisted venues and nothing else, can never withdraw, and the owner can revoke in any block.
**Milestone:** M1 · Core Vault + Zest Adapter on Testnet (due 2026-10-31, 18 days left)
**Next action:** fork-test v3 against Zest's sBTC vault, with no adapter (#5)
**Blocked on:** nothing in the repo. D-004 needs sign-off before M1 is submitted.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| v3: the delegate allocates and unwinds through the venue trait; every v2 limit and fix holds; the owner can always unwind | 23 tests against a deterministic venue | E-010 |
| The venue trait reaches Zest with no adapter | spike on a mainnet fork | E-009 |
| Full suite | `npx vitest run`: 54 of 54 tests across 15 files | E-010 |
| A contract can deposit sBTC into Zest and redeem it | the five probe transactions re-read from the mainnet API; fork tests | E-002, E-004 |
| Granite accepts a contract's sBTC as collateral | fork test | E-005 |
| Jing accepts a contract as maker: deposit and cancel | fork test pinned at block 9,036,500 | E-006 |
| Bitflow refuses a contract as recipient | deployed source of five pools; fork test | E-003 |
| CI: identity check and both fork suites on every pull request | green on GitHub's runners | E-008 |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| mandate-probe-mainnet | Stacks mainnet | `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet` | 2026-10-13 |

The vault itself isn't deployed anywhere yet.

## Broken or unverified
- v3 hasn't run against real Zest yet; only the spike's call pattern has (#5).
- v3 trusts the amounts a venue reports from `deposit` and `redeem`; measuring balances instead is #6.
- v3 handles SIP-010 assets only: native STX would need a `with-stx` allowance.
- Jing fills: untested, since settlement needs a signed Pyth update.

## Open questions
- Does a `contract-hash?` check add anything to the per-owner venue allowlist, given deployed contracts can't change? Decide in #6.
- Is D-004 (testnet mocks) acceptable for M1? The owner confirms.
