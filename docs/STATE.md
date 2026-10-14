# State
_Last verified: 2026-10-14 at `68be905`_

**Thesis:** an owner can put someone else in charge of their sBTC without handing over the keys. The delegate moves funds between allowlisted venues and nothing else, can never withdraw, and the owner can revoke in any block.
**Milestone:** M2 · Mainnet Launch + Adversarial Suite (due 2026-12-05, 52 days left). M1's exit criteria are met (E-014, E-022, E-024); D-017 awaits sign-off.
**Next action:** static checks and the findings log (#37)
**Blocked on:** nothing for #37. The mainnet issues (#34 to #36) need the owner to fund the deployer with STX and the mandate with sBTC and about 20 USDCx.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| A stranger can follow the README: from a fresh clone, `npm ci`, both mainnet fork suites and `npm run testnet:verify` pass with only Node on PATH. The testnet fork suite was added after that run | fresh clone of `9-readme` from GitHub; the testnet suite locally | E-022, E-023 |
| v4, the testnet sBTC venue and both traits are deployed on testnet, each with the repo's source and Clarity version, and testnet sBTC's cap is set | `npm run testnet:verify`: 16 of 16 checks | E-030 |
| One mandate end to end on testnet with testnet's official sBTC, now on v4: deposit, grant, allocate, unwind, withdraw, and the books reconcile | 7 transactions, every one `(ok …)` | E-024, E-030 |
| The reference delegate moves funds without the owner signing: two allocations and three unwinds on testnet, signed by the delegate alone in deny mode, reading its limits through `mandate-of` | testnet transactions; 6 decision tests | E-031 |
| The vault and the testnet sBTC venue against testnet's official sBTC, on a testnet fork | 2 tests, pinned at testnet block 719,800 | E-023 |
| `npm run testnet` rebuilds and reruns in one command, and stops rather than run against a stale deployment | reruns on the live deployment; a contract edited locally | E-019, E-024 |
| v3: the delegate allocates and unwinds through the venue trait; every v2 limit and fix holds; the owner can always unwind | 23 tests against a deterministic venue | E-010 |
| v3 measures every venue call and refuses a hostile venue's attacks with nothing moved | 7 hostile-venue tests | E-012 |
| v3 against Zest's real sBTC vault, with no adapter: allocate, unwind, owner exit, every refusal | fork test; with the vault's own token trait, still 99,937 shares in and 99,999 sats out | E-011, D-014 |
| The venue trait reaches Zest with no adapter | spike on a mainnet fork | E-009 |
| Local suites, with no fork: 95 tests in 6 files in about 6 s | `npx vitest run --config vitest.local.config.ts` | E-032, E-033 |
| Invariants hold over random sequences: the vault's tokens match the owners' idle balances, its venue shares match their positions, no delegate's tokens grow, and every owner can always exit | two walks of 400 steps; a mutant fails at its step | E-033 |
| Fork suite, forking the pinned block 9,194,000 with two workers: 41 tests in 16 files | `npx vitest run`, 465 s | E-032 |
| The adversarial suite: 43 hostile-delegate cases across seven classes, each refused with the exact code, no asset events and no balance changed | `tests/v4-adversarial.test.ts`; two mutants make it fail | E-029 |
| v4 against Granite's USDCx lending pool through `granite-venue`: allocate, unwind, owner exit, refusals, the adapter's minimum | fork test; books match real balances to the unit | E-028, D-020 |
| v4 identifies callers by `contract-caller`: a contract an owner calls can't act as the owner, and a contract acting for itself still can | 3 tests; the same call against v3 succeeds | E-027 |
| v4 caps the vault's principal in each asset: refused one sat over (`u117`), room freed by withdrawals only, no deposit without a cap, set once by the deployer and never raised | 4 tests; the 42 v3 tests pass against v4 | E-026 |
| A contract can deposit sBTC into Zest and redeem it | the probe's five transactions, fees and final balances re-read from the mainnet API; fork tests | E-002, E-004, E-022 |
| Granite accepts a contract's sBTC as collateral | fork test | E-005 |
| Jing accepts a contract as maker: deposit and cancel | fork test pinned at block 9,036,500, from a fresh clone and in CI | E-006, E-022 |
| Bitflow refuses a contract as recipient | deployed source of five pools; fork test | E-003 |
| CI: identity check and both fork suites on every pull request, each fork suite up to three attempts a minute apart | green on GitHub's runners; on #23 a failed attempt waited its minute and the retry passed | E-008, E-015, E-020, E-021 |
| The protocol specification names every v3 test, and CI fails if one goes missing | `node scripts/spec-crosscheck.mjs`: 42 of 42 | E-014, E-016 |
| `grant` refuses parameters that switch a limit off or abort later | 5 tests | E-016 |
| `npm audit` finds no vulnerabilities | `npm audit` on the patched lockfile | E-025 |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| mandate-vault-v4, mock-venue-sbtc, sip-010-trait, venue-trait; v3, mock-token and mock-venue from M1's runs | Stacks testnet | all under `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5` (`docs/CONTEXT.md`) | 2026-10-14, `npm run testnet:verify` |
| mandate-probe-mainnet | Stacks mainnet | `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet` | 2026-10-14 |

The vault is not on mainnet yet; that is M2.

## Broken or unverified
- v3 stays on testnet as M1's record and still identifies callers by `tx-sender` (E-027). Nothing uses it now that v4 runs there (E-030).
- CI's rate-limit waits reached 24 a run before the local suites stopped forking; how far that brings them down is measured on #45.
- Jing fills: untested, since settlement needs a signed Pyth update.

## Open questions
- Is D-017 acceptable for M1, with the testnet venue as the one stand-in? The owner confirms.
