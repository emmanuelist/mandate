# State
_Last verified: 2026-10-13 at `c519429`_

**Thesis:** an owner can put someone else in charge of their sBTC without handing over the keys. The delegate moves funds between allowlisted venues and nothing else, can never withdraw, and the owner can revoke in any block.
**Milestone:** M1 · Core Vault + Zest Adapter on Testnet (due 2026-10-31, 18 days left)
**Next action:** route the delegate's moves through a venue trait (#4)
**Blocked on:** nothing in the repo. D-004 needs sign-off before M1 is submitted.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Policy engine with seven limits; the five adversarial fixes hold | `npx vitest run`: 30 of 30 tests across 13 files | E-007 |
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
- The vault can't allocate anywhere yet: `execute` calls Bitflow, whose pools refuse a contract (#4).
- No Zest adapter (#5), and nothing yet bounds an adapter while it holds funds (#6).
- Jing fills: untested, since settlement needs a signed Pyth update.

## Open questions
- Does a `contract-hash?` check add anything to the principal allowlist, given deployed contracts can't change? Decide in #6.
- Is D-004 (testnet mocks) acceptable for M1? The owner confirms.
