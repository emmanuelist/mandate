# State
_Last verified: 2026-10-14 at `e749256`_

**Thesis:** an owner can put someone else in charge of their sBTC without handing over the keys. The delegate moves funds between allowlisted venues and nothing else, can never withdraw, and the owner can revoke in any block.
**Milestone:** M2 · Mainnet Launch + Adversarial Suite (due 2026-12-05, 52 days left). M1's exit criteria are met (E-014, E-022, E-024); D-017 awaits sign-off.
**Next action:** the mainnet deployment of v5 and the Granite adapter (#34): a runbook and deploy script, dry-run against mainnet without broadcasting. The transactions themselves wait for the owner's go-ahead
**Blocked on:** nothing for preparing #34. Mainnet transactions (#34 to #36) need the owner's go-ahead, STX for the deployer, and sBTC and about 20 USDCx for the mandate.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| The structured review is published: `docs/REVIEW.md` logs 15 findings with severity, status and fixing commit or reason. Static checks: four manifests type-check with no errors, and each of Clarinet's 64 warnings is justified at its line, or the check fails | `npm run static`; four mutants make it fail | E-036, D-023 |
| v5 closes the vault while a venue runs: a venue that calls back in is refused with nothing moved, and the attack that drains another owner on v4 fails on v5 through every path tried | 9 tests on v4 and v5; 15 adversarial re-entry cases; v5 without the check fails 21 tests | E-035, D-022 |
| A stranger can follow the README: from a fresh clone, `npm ci`, both mainnet fork suites and `npm run testnet:verify` pass with only Node on PATH. The testnet fork suite was added after that run | fresh clone of `9-readme` from GitHub; the testnet suite locally | E-022, E-023 |
| v5, the testnet sBTC venue and both traits are deployed on testnet, each with the repo's source and Clarity version, and testnet sBTC's cap reads back as 1,000,000 sats | `npm run testnet:verify`: 25 of 25 checks | E-037 |
| One mandate end to end on testnet with testnet's official sBTC, now on v5: deposit, grant, allocate, unwind, withdraw, and the books reconcile, net of any transfer from outside the run | 7 transactions, every one `(ok …)` | E-024, E-037 |
| The reference delegate moves funds without the owner signing: two allocations and two unwinds on v5, signed by the delegate alone in deny mode, reading its limits through `mandate-of` | testnet transactions; 10 tests of its decisions and attempts | E-031, E-037 |
| The vault refuses the delegate on the record: four calls its mandate forbids, signed by the delegate on testnet (over the per-move cap, an unlisted venue, a withdrawal, after a revoke), each refused with its code and no events | `npm run testnet:verify` | E-037, D-024 |
| The vault and the testnet sBTC venue against testnet's official sBTC, on a testnet fork | 2 tests, pinned at testnet block 719,800 | E-023 |
| `npm run testnet` rebuilds and reruns in one command, and stops rather than run against a stale deployment | reruns on the live deployment; a contract edited locally | E-019, E-024 |
| v3: the delegate allocates and unwinds through the venue trait; every v2 limit and fix holds; the owner can always unwind | 23 tests against a deterministic venue | E-010 |
| v3 measures every venue call and refuses the hostile venue's five tested attacks with nothing moved. It misses a venue that re-enters with a deposit during an unwind (#48) | 7 hostile-venue tests | E-012 |
| v3 against Zest's real sBTC vault, with no adapter: allocate, unwind, owner exit, every refusal | fork test; with the vault's own token trait, still 99,937 shares in and 99,999 sats out | E-011, D-014 |
| The venue trait reaches Zest with no adapter | spike on a mainnet fork | E-009 |
| Local suites, with no fork: 119 tests in 7 files in about 11 s | `npx vitest run --config vitest.local.config.ts` | E-032, E-033, E-035 |
| Invariants hold over random sequences, with one of two venues calling back in at random: the vault's tokens match every idle balance it records, its shares in each venue match the positions, no delegate's tokens grow, every owner can always exit, and every call back is refused | two walks of 400 steps, 74 seeds on v5; on v4 every seed tried fails | E-033, E-035 |
| Fork suite on v5, forking the pinned block 9,194,000 with two workers: 41 tests in 16 files | `npx vitest run`, 464 s | E-032, E-035 |
| The adversarial suite on v5: 58 cases across eight classes, re-entry among them, each refused with the exact code, no asset events and no balance changed | `tests/v5-adversarial.test.ts`; two mutants make it fail, and v5 without its check fails the re-entry class | E-029, E-035 |
| The vault against Granite's USDCx lending pool through `granite-venue`: allocate, unwind, owner exit, refusals, the adapter's minimum | fork test, now on v5; books match real balances to the unit | E-028, E-035, D-020 |
| v4 and v5 identify callers by `contract-caller`: a contract an owner calls can't act as the owner, and a contract acting for itself still can | 3 tests, now on v5; the same call against v3 succeeds | E-027, E-035 |
| v4 and v5 cap the vault's principal in each asset: refused one sat over (`u117`), room freed by withdrawals only, no deposit without a cap, set once by the deployer and never raised | 4 tests; the 42 v3 tests pass against v4 | E-026 |
| A contract can deposit sBTC into Zest and redeem it | the probe's five transactions, fees and final balances re-read from the mainnet API; fork tests | E-002, E-004, E-022 |
| Granite accepts a contract's sBTC as collateral | fork test | E-005 |
| Jing accepts a contract as maker: deposit and cancel | fork test pinned at block 9,036,500, from a fresh clone and in CI | E-006, E-022 |
| Bitflow refuses a contract as recipient | deployed source of five pools; fork test | E-003 |
| CI: identity check and both fork suites on every pull request, each fork suite up to three attempts a minute apart | green on GitHub's runners; on #23 a failed attempt waited its minute and the retry passed | E-008, E-015, E-020, E-021 |
| The protocol specification names every test in the vault's suites, and CI fails if one goes missing | `node scripts/spec-crosscheck.mjs`: 125 of 125 | E-014, E-016, E-035 |
| `grant` refuses parameters that switch a limit off or abort later | 5 tests | E-016 |
| `npm audit` finds no vulnerabilities | `npm audit` on the patched lockfile | E-025 |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| mandate-vault-v5, mock-venue-sbtc, sip-010-trait, venue-trait; v4 and v3, which hold nothing, and mock-token and mock-venue from earlier runs | Stacks testnet | all under `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5` (`docs/CONTEXT.md`) | 2026-10-14, `npm run testnet:verify` |
| mandate-probe-mainnet | Stacks mainnet | `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet` | 2026-10-14 |

The vault is not on mainnet yet; that is M2.

## Broken or unverified
- v3 stays on testnet as M1's record and still identifies callers by `tx-sender` (E-027). Nothing uses it.
- **v3 and v4 credit a venue's call back twice during an unwind**, so an owner who lists their own venue can take other owners' funds (#48, E-035). Both are on testnet only and hold nothing. v5 fixes it (D-022) and is deployed on testnet (E-037); mainnet is #34.
- CI's fork suite still waits on Hiro's rate limit 11 to 14 times a run after #45; the 93 local tests wait none (E-034).
- Jing fills: untested, since settlement needs a signed Pyth update.

## Open questions
- Is D-017 acceptable for M1, with the testnet venue as the one stand-in? The owner confirms.
