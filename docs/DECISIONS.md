# Decisions
Append-only. To change a decision, add a new entry that supersedes it; never edit an old one.
D-001 to D-008 were written on 2026-10-13, several from earlier work. Each carries the date its choice was made.

## D-001 · Build a non-custodial delegation vault for sBTC · 2026-08-30 · accepted
**Context:** putting someone else in charge of a Bitcoin treasury on Stacks means handing them the keys, so in practice nobody delegates, and every managed strategy runs on its manager's own balance sheet.
**Decision:** a Clarity vault. An owner deposits sBTC and grants a named delegate allocation-only authority under a policy the contract enforces: asset and venue allowlists, a per-move cap, a rate window, a daily cap, an on-chain minimum output, a cumulative slippage budget and an expiry. The delegate can never withdraw. Withdrawal pays the owner only, and the owner can revoke in any block.
**Alternatives:** a policy service off-chain that holds the keys (trust moves to a server); a trading bot on a DEX (see D-002).
**Consequences:** custody correctness comes before features, and every policy limit needs an adversarial test.
**Evidence:** E-001, E-002, E-007.

## D-002 · Allocate into lending venues; don't trade on Bitflow · 2026-08-30 · accepted
**Context:** the first design executed swaps on Bitflow. On a mainnet fork the swap failed with `u3003`: every Bitflow pool checked refuses a contract as recipient (E-003). Deployed Clarity contracts can't change, so those pools stay closed to a vault.
**Decision:** Zest is the first venue, since it accepts a contract as depositor (E-004). Granite is the second (E-005). Bitflow is not a venue.
**Alternatives:** wait for new Bitflow pools, which there's no sign of and which aren't ours to schedule.
**Consequences:** the delegate's entry points become allocate and unwind on deposit-and-redeem venues (#4). Jing's market accepts a contract as maker (E-006), which could reopen trading later; that isn't committed.
**Evidence:** E-003, E-004, E-005, E-006; `BITFLOW-REPORT.md`.

## D-003 · Milestones depend only on work under our control · 2026-09-02 · accepted
**Context:** small projects stall when a milestone waits on another team to ship or integrate.
**Decision:** no exit criterion requires another team to act. Adoption is shown through mandates we run and reference adapters written against public MIT-licensed code. Validation from outside, when added, is a documented review with at least one operator rather than a named team (proposed 2026-09-07; see `docs/PLAN.md`).
**Alternatives:** naming partner teams in the exit criteria.
**Consequences:** no other team's schedule can block a milestone, and adoption claims stay exactly as large as the evidence.

## D-004 · M1's testnet run uses a mock sBTC and a mock yield venue · 2026-10-13 · proposed
**Context:** testnet was reset on 2026-08-05 and has no canonical sBTC and no Zest (`docs/CONTEXT.md`). M1 asks for a testnet run in which a funded mandate allocates to a yield venue.
**Decision:** run M1's testnet flow through a mock sBTC and a mock venue behind the same venue trait, prove the real Zest adapter against Zest's deployed contract on a mainnet fork (#5), and go to mainnet in M2.
**Alternatives:** wait for Zest on testnet (no sign it's coming); move M1 to mainnet (changes the milestone).
**Consequences:** M1's evidence is testnet transaction hashes plus fork-test output. Needs sign-off before M1 is submitted.

## D-005 · Commit identity, and how branches merge · 2026-10-13 · accepted
**Context:** GitHub's merge buttons create commits whose committer is GitHub and whose author is a noreply address. Agents have added attribution trailers to commit messages in other projects, which then needed a history rewrite.
**Decision:** every commit is authored and committed by `emmanuelist <emmanuel.paul75@yahoo.com>`. Branches merge locally with `--ff-only` and are pushed; GitHub marks the pull request merged. Commit messages carry no trailers. CI checks all of this on every pull request and every push to `main`, reading its banned words from a repository secret so the check never writes them into history.
**Alternatives:** GitHub's merge buttons, which break the rule on every pull request.
**Consequences:** rebase a branch on `main` before merging; a red identity check blocks the merge.

## D-006 · Private notes live in internal/ · 2026-10-13 · accepted
**Context:** listing private files by name in `.gitignore` published their names.
**Decision:** one ignored folder, `internal/`, holds every private draft and note.

## D-007 · M3 commits to a public ledger page, not an owner app · 2026-09-02 · accepted
**Context:** an owner-facing app is the natural product, but a first build should promise only what it can evidence.
**Decision:** M3's committed deliverable is the public ledger page: per-allocation quoted versus realised output and slippage in basis points. The app (connect a wallet, read the compiled policy before signing, watch allocations, revoke in one click) is the direction, not a commitment.
**Consequences:** UI work after the ledger page is optional until a new decision makes it otherwise.

## D-008 · No external audit before the AUM cap rises · 2026-09-02 · accepted
**Context:** an external audit doesn't fit this stage's budget.
**Decision:** bound exposure instead. From the first mainnet deploy the contract enforces a per-vault AUM cap (M2), backed by a structured review: threat model, invariant tests, at least 40 adversarial cases in public CI, static checks and a published findings log. An external audit comes before that cap rises.
**Consequences:** the cap stays low until audited.

## D-009 · The vault calls venues through its own trait; Zest needs no adapter · 2026-10-13 · accepted
**Context:** Zest's vaults take funds from `contract-caller`, so an adapter between the vault and Zest would hold the funds during every call, which is what #5 and #6 first planned around. Zest's vaults also implement Zest's own `tokenized-vault` trait.
**Decision:** `contracts/venue-trait.clar` declares the four functions the vault needs, in the tokenized-vault shape. Zest's vaults satisfy it as deployed, because trait conformance is structural, so the vault calls Zest directly and is Zest's account: it pays from its own balance under an `as-contract?` allowance capped at the move, and holds its own shares. Adapters are only for venues without this shape, such as Granite's lending pool in M2.
**Alternatives:** an adapter for every venue, Zest included, which holds funds in every call; typing the venue as Zest's own trait principal, which ties the vault to Zest's deployment and can't deploy to testnet, where Zest doesn't exist.
**Consequences:** #5 becomes a fork test of the vault against Zest with no adapter, and #6 bounds what a venue can do in a call rather than what an adapter does while holding funds. This replaces the adapter plan #5 and #6 were first written around.
**Evidence:** E-009, E-010.

## D-010 · No contract-hash check on venues · 2026-10-13 · accepted
**Context:** #6 asked whether a `contract-hash?` check adds anything to the per-owner venue allowlist.
**Decision:** no. The allowlist pins each venue by principal, and the code at a deployed principal can never change, so hashing it adds nothing. What can change at a fixed principal is its data, such as Zest's pause flags or fee settings, and a code hash doesn't see that either.
**Alternatives:** pinning by code hash so an owner could approve any contract with a given code, which only helps when venues are many instances of one template. Mandate doesn't use those.
**Consequences:** revisit if venues ever come from a template deployed per owner or per pool.

## D-011 · Measure, don't trust; the vault can't be its own delegate · 2026-10-13 · accepted
**Context:** v3 credited whatever a venue's `deposit` and `redeem` returned. Tests with a hostile venue (E-012) also showed that Clarity lets a venue call back into the vault mid-call, running as the vault itself.
**Decision:** every venue call is bracketed by balance reads, and the books follow what arrived. A call is refused if anything other than the move left the vault, fewer shares arrived than reported, other than the asked shares were burned, or fewer assets arrived than reported (`ERR_MISREPORT`, u114). The vault refuses to be granted as a delegate (`ERR_AGENT`, u115), so a callback running as the vault holds no mandate to act on.
**Alternatives:** trusting the venue's return values, which lets a buggy venue inflate a position; forbidding callbacks, which Clarity has no guard for. The vault's own identity is the protection.
**Consequences:** each allocate and unwind makes four extra reads. A venue still answers for its own share ledger, so the per-owner allowlist stays the trust anchor.
**Evidence:** E-012.

## D-012 · Fork tests run at a pinned block, two workers at a time, with the fork data cached in CI · 2026-10-13 · accepted
**Context:** CI failed twice on 2026-10-13 for reasons unrelated to the code. At the tip, a lagging Hiro node answered "Block not found" and the Clarinet SDK panicked; and with many workers at once, some failed to start (`docs/CONTEXT.md`). Forking the tip also lets results drift with mainnet from one run to the next.
**Decision:** the main suite forks block 9,194,000 (`initial_height` in `Clarinet.toml`), as the Jing suite already forks 9,036,500. At most two workers run at once. CI caches `.cache`, keyed on both manifests, so a pinned block's fork data is fetched once.
**Alternatives:** retrying failed runs, which hides real failures; one file at a time, slower and untested; staying at the tip, where the panic is inside the SDK and can't be fixed from this repo.
**Consequences:** results are reproducible at a known block. A venue change after the pinned block isn't seen until the height is bumped, which is a deliberate commit, and the first CI run after a bump fetches from scratch.
**Evidence:** E-013.

## D-013 · CI doesn't cache fork data, and retries the fork suites up to three times · 2026-10-13 · supersedes D-012's caching
**Context:** after D-012, CI still failed three times on code it didn't touch. With `main`'s cached fork data restored, #17 failed the same two tests twice, with runtime type errors inside forked Zest and Bitflow contracts. Without the cache, #19 failed when two workers couldn't start, four seconds after a burst of rate-limit waits; that run hit Hiro's rate limit 13 times. Locally, with two workers, the suite has passed. The SDK retries most rate-limited requests but evidently not every path, and it has no setting for an API key.
**Decision:** CI fetches fork data fresh on every run, and runs each fork suite up to three times, stopping at the first pass. The forks stay pinned and the run keeps two workers.
**Alternatives:** keep the cache, which saves requests but was present when a run read wrong data, a worse failure than a worker that can't start; one worker at a time, which lowers the load but doesn't remove the rate limit and roughly doubles the run; an API key, which the SDK can't send.
**Consequences:** the forks are pinned and the suite has no randomness, so a real failure fails all three attempts, while a rate-limit failure usually doesn't. A bad day costs up to three runs, so the job's limit is 45 minutes. Each failed attempt leaves a warning in the log.

## D-014 · The vault carries its own copy of the SIP-010 trait · 2026-10-14 · accepted
**Context:** v3 named the standard SIP-010 trait by its mainnet address, `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard`. Testnet's reset on 2026-08-05 erased the testnet copies: neither `ST3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8NQXMNRQ` (the same deployer on testnet) nor `ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT` has the contract, so v3 couldn't deploy there (#7).
**Decision:** `contracts/sip-010-trait.clar` is a verbatim copy of mainnet's trait, and v3 and the mock token use it. Clarity matches traits by shape (`docs/CONTEXT.md`), so real sBTC, which declares mainnet's trait, still passes as this one.
**Alternatives:** pointing v3 at a copy deployed on testnet, which gives each network a different source, so testnet wouldn't run the code the tests run.
**Consequences:** one source runs in the tests, on testnet and, in M2, on mainnet, and `npm run testnet` refuses to run against a deployment whose source differs from the repo's. On a mainnet fork, sBTC still fits, Zest gives the same 99,937 shares in and 99,999 sats out, and the full suite passes.
**Evidence:** E-017, E-011.

## D-015 · A CI retry waits a minute · 2026-10-14 · supersedes D-013's back-to-back retries
**Context:** D-013 retries a failed fork suite at once. On `main` after #21 the full suite passed, then the Jing suite's worker failed to start three times in 2.6 s. Three seconds before the first attempt, Hiro had told the runner to wait 29 and 53 s, so all three attempts fell inside that window. The pull request's run of the same code started the Jing suite after its last wait had run out, and passed (E-020).
**Decision:** a failed attempt waits 60 s before the next. The longest wait Hiro has asked for in our logs is 57 s.
**Alternatives:** running the Jing suite before the full suite's burst of requests, which avoids this case but not a worker failing mid-suite (#19); waiting before every suite, which costs a minute on every run rather than only after a failure.
**Consequences:** a real failure takes two minutes longer to report, well inside the job's 45. That a worker can't start because its first fork requests are rate-limited is inferred from the timing, not traced inside the SDK.
**Evidence:** E-020, E-021.

## D-016 · The vault holds SIP-010 tokens only; native STX is out of scope · 2026-10-14 · accepted
**Context:** v3 moves assets under `as-contract?` allowances of the form `with-ft`, which cover SIP-010 tokens. Native STX would need a `with-stx` allowance and its own transfer path. `docs/STATE.md` listed the gap, but nothing recorded why it's acceptable.
**Decision:** the vault holds SIP-010 tokens only. sBTC is one, and so is every asset the venues in scope take from the vault.
**Alternatives:** a native STX path, with its own allowance, deposit, withdrawal and tests, for no venue in M1 to M3.
**Consequences:** an owner can't deposit native STX. Revisit if a venue that takes native STX, such as STX staking, comes into scope.

## D-017 · M1's testnet run uses testnet's official sBTC; only the venue is a stand-in · 2026-10-14 · proposed, supersedes D-004
**Context:** D-004 replaced both sBTC and the venue with mocks on testnet, on the premise that testnet had neither. Testnet does have an official sBTC, `SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token`, deployed the day after the reset (`docs/CONTEXT.md`). Only Zest is missing.
**Decision:** M1's testnet run uses real testnet sBTC. The venue remains a stand-in: `mock-venue-sbtc` has `mock-venue`'s semantics and holds testnet sBTC. A venue must name the token it moves, and this one names a testnet contract, so it deploys only to testnet and is tested on a testnet fork pinned at block 719,800 (`Clarinet-testnet.toml`), which CI runs on every pull request. The vault's integration with Zest stays proven on a mainnet fork (E-011).
**Alternatives:** keeping the mock token, which leaves an avoidable stand-in in M1's evidence; a venue that takes its token as an argument, which the venue trait's `deposit (amount min-out recipient)` does not allow.
**Consequences:** reproducing the run needs 20,000 sats of testnet sBTC as well as STX, and the sBTC returns to the owner at the end. The earlier mock-token run (E-018, E-019) stays in the record. Like D-004, this needs sign-off before M1 is submitted, now for one stand-in, the venue.
**Evidence:** E-023, E-024.

## D-018 · v4 caps the vault's principal in each asset; sBTC's mainnet cap is 0.01 BTC · 2026-10-14 · accepted
**Context:** M2 takes the vault to mainnet under a per-vault AUM cap the contract enforces, so its exposure is fixed and readable on-chain (D-008). Tokens differ in units, the measure has to be one the vault can read without trusting a venue, and one source has to deploy on every network (D-014).
**Decision:** v4 is v3 plus a cap on the vault's principal in each asset, across all owners. Principal is deposits less withdrawals: funds in a venue still count, and a withdrawal that includes yield can't take it below zero. The deployer sets each asset's cap once, never to zero, and nothing changes it afterwards; an asset without a cap can't be deposited. On mainnet, sBTC's cap is 1,000,000 sats (0.01 BTC), the owner's choice. The suites move to v4, and v3 stays unchanged in the repo as the contract deployed on testnet for M1.
**Alternatives:** a cap written into the source, which would name each network's token and break one source per network; a cap on the vault's live holdings, which would value venue positions by the venues' own quotes; a cap the deployer can raise, which turns the limit back into a policy statement.
**Consequences:** the deployer can enable a new asset by setting its cap, but can never raise one, so a higher cap means a new deployment after an external audit (D-008). The deployer is now a role, and the specification's trust assumptions say so.
**Evidence:** E-026.

## D-019 · The vault identifies callers by contract-caller · 2026-10-14 · accepted
**Context:** v3 identifies owners and delegates by `tx-sender`, which passes through every contract an owner calls. A contract posing as an airdrop can, in the call an owner signs, allowlist its own venue, grant the owner a mandate and allocate the owner's idle funds into that venue. The vault's measurement checks pass, because the venue takes exactly the amount moved (E-027). v3 is on testnet only and holds nothing of value.
**Decision:** v4 identifies the owner and the delegate by `contract-caller` in every function that acts on someone's books, so a contract an owner calls is itself the caller and acts only on its own books. `tx-sender` remains only inside the vault's own `as-contract?` bodies, where it is the vault, and in the deployer constant.
**Alternatives:** keeping `tx-sender` and relying on wallet post-conditions, which can't stop the allowlist and grant calls since those move no assets, and which a malicious app can set to allow; requiring `tx-sender` and `contract-caller` to match, which would shut out owners that are contracts.
**Consequences:** an owner or delegate that is a contract calls the vault from inside `as-contract?`. An intermediary can no longer act for an owner by passing on their `tx-sender`: anything acting for an owner needs a mandate in its own name.
**Evidence:** E-027.

## D-020 · The second venue is Granite's USDCx lending pool, through an adapter that holds the LP tokens · 2026-10-14 · accepted
**Context:** M2 needs a second venue behind the venue trait, on mainnet, with an interface unlike Zest's. Granite offers two paths (#32). Its lending pool, `liquidity-provider-v1`, earns yield on USDCx: it takes USDCx from its caller and mints LP tokens to a recipient, but burns them from its caller on redeem, takes no minimum output, and returns only a bool. Its sBTC path is borrowing collateral, which earns nothing, and `remove-collateral` needs a signed Pyth price update that the venue trait's `redeem (shares min-out recipient)` has no way to pass.
**Decision:** the second venue is the USDCx lending pool, through `contracts/granite-venue.clar`. The adapter supplies USDCx to Granite in its own name, holds the LP tokens, and mints its own shares one per LP token. It enforces the minimum output Granite doesn't take, and returns what it measured. USDCx's cap in v4 is 1,000 USDCx, about the scale of sBTC's 0.01 BTC, and the live mandate needs about 20 USDCx, which Bitflow's pools sell.
**Alternatives:** sBTC as collateral, rejected for the reasons above; a second Zest vault, which would not show the trait holding across protocols; letting the vault hold Granite's LP tokens directly, which the pool doesn't allow, since redeem burns from its caller.
**Consequences:** the adapter custodies every owner's Granite position, so its code is trusted as far as that, and the cap bounds what it can hold. Granite's operators can pause deposits or withdrawals, and withdrawals need unborrowed liquidity, so an unwind can wait. Granite accrues interest when a call starts, so a deposit mints slightly fewer shares than a quote taken just before it, and a zero-slippage mandate can't use Granite.
**Evidence:** E-028; the spike on #32.
