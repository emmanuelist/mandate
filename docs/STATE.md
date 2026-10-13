# State
_Last verified: 2026-10-14 at `afbdf1e`_

**Thesis:** an owner can put someone else in charge of their sBTC without handing over the keys. The delegate moves funds between allowlisted venues and nothing else, can never withdraw, and the owner can revoke in any block.
**Milestone:** M1 · Core Vault + Zest Adapter on Testnet (due 2026-10-31, 18 days left)
**Next action:** make v3 deployable on testnet, which lost the standard token trait in its August reset, then deploy and record the end-to-end run (#7)
**Blocked on:** #7 needs funded testnet accounts from the owner. D-004 needs sign-off before M1 is submitted.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| v3: the delegate allocates and unwinds through the venue trait; every v2 limit and fix holds; the owner can always unwind | 23 tests against a deterministic venue | E-010 |
| v3 measures every venue call and refuses a hostile venue's attacks with nothing moved | 7 hostile-venue tests | E-012 |
| v3 against Zest's real sBTC vault, with no adapter: allocate, unwind, owner exit, every refusal | fork test; ledger and real balances agree to the sat | E-011 |
| The venue trait reaches Zest with no adapter | spike on a mainnet fork | E-009 |
| Full suite, forking the pinned block 9,194,000 with two workers | `npx vitest run`: 73 of 73 tests across 17 files | E-016 |
| A contract can deposit sBTC into Zest and redeem it | the five probe transactions re-read from the mainnet API; fork tests | E-002, E-004 |
| Granite accepts a contract's sBTC as collateral | fork test | E-005 |
| Jing accepts a contract as maker: deposit and cancel | fork test pinned at block 9,036,500 | E-006 |
| Bitflow refuses a contract as recipient | deployed source of five pools; fork test | E-003 |
| CI: identity check and both fork suites on every pull request, each fork suite up to three attempts | green on GitHub's runners | E-008, E-015 |
| The protocol specification names every v3 test, and CI fails if one goes missing | `node scripts/spec-crosscheck.mjs`: 42 of 42 | E-014, E-016 |
| `grant` refuses parameters that switch a limit off or abort later | 5 tests | E-016 |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| mandate-probe-mainnet | Stacks mainnet | `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet` | 2026-10-13 |

The vault itself isn't deployed anywhere yet.

## Broken or unverified
- v3 handles SIP-010 assets only: native STX would need a `with-stx` allowance.
- Jing fills: untested, since settlement needs a signed Pyth update.

## Open questions
- Is D-004 (testnet mocks) acceptable for M1? The owner confirms.
