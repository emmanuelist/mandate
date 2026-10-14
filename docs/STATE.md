# State
_Last verified: 2026-10-14 at `b97080f`_

**Thesis:** an owner can put someone else in charge of their sBTC without handing over the keys. The delegate moves funds between allowlisted venues and nothing else, can never withdraw, and the owner can revoke in any block.
**Milestone:** M1 · Core Vault + Zest Adapter on Testnet (due 2026-10-31, 17 days left)
**Next action:** the owner decides whether M1's testnet run moves to the official testnet sBTC (open question below); meanwhile, patch the test tooling's npm advisory (#24)
**Blocked on:** the testnet sBTC question, which the owner answers. D-004 needs sign-off before M1 is submitted.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| A stranger can follow the README: from a fresh clone, `npm ci`, both fork suites and `npm run testnet:verify` pass with only Node on PATH | fresh clone of `9-readme` from GitHub | E-022 |
| v3, a mock sBTC, a mock venue and both traits are deployed on testnet, each with the repo's source and Clarity version | `npm run testnet:verify`: 14 of 14 checks | E-017, E-022 |
| One mandate end to end on testnet: deposit, grant, allocate, unwind, withdraw, and the books reconcile | two runs, 18 transactions, every one `(ok …)` | E-018, E-019 |
| `npm run testnet` rebuilds and reruns in one command, and stops rather than run against a stale deployment | rerun on the live deployment; a contract edited locally | E-019 |
| v3: the delegate allocates and unwinds through the venue trait; every v2 limit and fix holds; the owner can always unwind | 23 tests against a deterministic venue | E-010 |
| v3 measures every venue call and refuses a hostile venue's attacks with nothing moved | 7 hostile-venue tests | E-012 |
| v3 against Zest's real sBTC vault, with no adapter: allocate, unwind, owner exit, every refusal | fork test; with the vault's own token trait, still 99,937 shares in and 99,999 sats out | E-011, D-014 |
| The venue trait reaches Zest with no adapter | spike on a mainnet fork | E-009 |
| Full suite, forking the pinned block 9,194,000 with two workers | `npx vitest run`: 73 of 73 tests in 17 files, from a fresh clone in 419 s and in CI | E-016, E-022 |
| A contract can deposit sBTC into Zest and redeem it | the probe's five transactions, fees and final balances re-read from the mainnet API; fork tests | E-002, E-004, E-022 |
| Granite accepts a contract's sBTC as collateral | fork test | E-005 |
| Jing accepts a contract as maker: deposit and cancel | fork test pinned at block 9,036,500, from a fresh clone and in CI | E-006, E-022 |
| Bitflow refuses a contract as recipient | deployed source of five pools; fork test | E-003 |
| CI: identity check and both fork suites on every pull request, each fork suite up to three attempts a minute apart | green on GitHub's runners; on #23 a failed attempt waited its minute and the retry passed | E-008, E-015, E-020, E-021 |
| The protocol specification names every v3 test, and CI fails if one goes missing | `node scripts/spec-crosscheck.mjs`: 42 of 42 | E-014, E-016 |
| `grant` refuses parameters that switch a limit off or abort later | 5 tests | E-016 |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| mandate-vault-v3, mock-token (mock sBTC), mock-venue, sip-010-trait, venue-trait | Stacks testnet | all under `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5` (`docs/CONTEXT.md`) | 2026-10-14, `npm run testnet:verify` |
| mandate-probe-mainnet | Stacks mainnet | `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet` | 2026-10-14 |

The vault is not on mainnet yet; that is M2.

## Broken or unverified
- `npm ci` reports one high-severity advisory in test tooling: `source-map-js` 1.2.1 under vitest (GHSA-68fv-2mgg-jv7q). Nothing here processes untrusted source maps (#24).
- Jing fills: untested, since settlement needs a signed Pyth update.

## Open questions
- Testnet has an official sBTC (`docs/CONTEXT.md`), so D-004's premise is half wrong. Should M1's testnet run move from the mock token to testnet sBTC, leaving only the venue mocked? The owner decides; a new decision then supersedes D-004.
- Is D-004 (testnet mocks) acceptable for M1? The owner confirms.
