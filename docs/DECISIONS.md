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
