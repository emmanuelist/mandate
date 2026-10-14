# Agents: start here

Mandate is a Clarity vault on Stacks. An owner deposits sBTC and grants a named delegate allocation-only authority: the delegate moves funds between allowlisted venues inside limits the contract enforces, can never withdraw, and the owner can revoke in any block.

Everything a session needs is in this repo. Nothing depends on chat history.

## Start every session here
1. Read `docs/STATE.md`: what's true now, the current milestone, and the next action.
2. Read the open issues for that milestone, for example `gh issue list --milestone "M1 · Core Vault + Zest Adapter on Testnet"`.
3. Read the last three entries of `docs/DECISIONS.md`.
4. Before touching any integration (Zest, Granite, Jing, Bitflow, sBTC), read `docs/CONTEXT.md`.

Then say the next action back before starting work.

## Where things live
| Concern | File |
|---|---|
| Current truth | `docs/STATE.md`, rewritten every session |
| Milestones and exit criteria | `docs/PLAN.md`; GitHub milestones mirror it |
| Work items | GitHub issues |
| Why we chose what we chose | `docs/DECISIONS.md`, append-only |
| Proof that things work | `docs/EVIDENCE.md`, append-only |
| Verified dependency facts, and traps | `docs/CONTEXT.md` |
| Findings, and every warning Clarinet raises with why it stands | `docs/REVIEW.md` |
| Private drafts and notes | `internal/`, gitignored and never committed |

## Commit identity (enforced by CI, D-005)
- Every commit is authored **and** committed by `emmanuelist <emmanuel.paul75@yahoo.com>`. Check `git config user.email` before committing.
- No trailers in commit messages, and no tool or agent named as an author or committer. Pull request descriptions carry no attribution either.
- Never use GitHub's merge buttons: they commit as GitHub. Merge locally, then push:
  ```sh
  git switch <branch> && git rebase main
  git switch main && git merge --ff-only <branch> && git push
  git push origin --delete <branch> && git branch -d <branch>
  ```
  GitHub marks the pull request merged once its commits reach `main`.

## Stack and commands
- Clarity 4 contracts in `contracts/`; Clarinet 3.24.1, `@stacks/clarinet-sdk` 3.23.2, Vitest 4, Node 26.
- `npm ci` once.
- `npm test` runs the local suites (`npx vitest run --config vitest.local.config.ts`: no fork, seconds) and then the fork suite (`npx vitest run`: about 6 to 10 minutes, every test forking Stacks mainnet through api.hiro.so, `[repl.remote_data]` in `Clarinet.toml`). A suite that needs no mainnet contract belongs in `LOCAL_SUITES` in `vitest.local.config.ts`. Wait for each summary line: partial output gives wrong counts.
- `npm run static` runs `clarinet check` (the Clarinet CLI, 3.24.1, on PATH) on every manifest and fails on an error, or on a warning `docs/REVIEW.md` doesn't justify at that line. After a contract change, update the table the same pull request. CI runs it.
- `npx vitest run --config vitest.jing.config.ts` runs the Jing fork, pinned at block 9,036,500 by `Clarinet-jing.toml`.
- `npx vitest run --config vitest.testnet.config.ts` runs the testnet fork, pinned at testnet block 719,800 by `Clarinet-testnet.toml`: the vault and the testnet sBTC venue against testnet's official sBTC.
- `npm run testnet` deploys the contracts `Clarinet-testnet.toml` lists to testnet from account 1 of `settings/Testnet.toml`, then runs one mandate end to end with testnet's official sBTC and account 2 as the delegate, and records both in `deployments/`. It skips a contract already deployed with the repo's source and stops if the source differs. A fresh account spends 7.51 testnet STX and needs 20,000 sats of testnet sBTC, which come back at the end of the run.
- `npm run testnet:verify` re-checks `deployments/` against the chain with no keys; `npm run testnet:accounts` prints both testnet addresses and their balances.
- The reference delegate (`scripts/delegate.mjs`) holds only its own key, in `settings/Delegate-<network>.toml` (gitignored; never print it). `npm run delegate:key -- <network>` creates it, `npm run testnet:mandate` is the owner's side on testnet (`-- revoke` and `-- exit` revoke the mandate and return the owner's funds), and `npm run delegate -- <network> <target-bps,...>` runs it. `npm run delegate -- <network> attempt <over-cap|unlisted-venue|withdraw|revoked>` signs one call the mandate forbids and records its refusal (D-024).
- `settings/Mainnet.toml` holds the mainnet deployer mnemonic and `settings/Testnet.toml` a testnet-only seed. Both are gitignored: never print or commit them.

## Clarity 4 notes
- The vault moves its own funds with `as-contract?` and explicit allowances, for example `(as-contract? ((with-ft <token> "<asset>" <amount>)) body)`. The body's last expression can't be a response, so put `try!` inside it.
- `tx-sender` versus `contract-caller` decides who pays. Zest takes funds from `contract-caller` (`docs/CONTEXT.md`).
- Venues don't share one SIP-010 trait: Bitflow defines its own, and Granite and Jing use the canonical one. The vault uses a verbatim copy of the canonical one, `contracts/sip-010-trait.clar`, so the same source deploys on testnet, where the reset erased the original (D-014).

## Session protocol
- **Start:** the four steps above.
- **Work:** one issue at a time, on a branch named `<issue>-<slug>`. Each pull request says `Closes #<n>` and carries its evidence.
- **Finish:** append to `docs/EVIDENCE.md` and `docs/DECISIONS.md`; add anything verified about a dependency to `docs/CONTEXT.md`; close issues with links to their evidence; rewrite `docs/STATE.md`; commit.
- **Truth rule:** never write a claim into STATE, the README, an issue or a pull request that wasn't verified in the same session. Write "unverified" instead.
- **Decisions:** don't relitigate an accepted decision without new evidence; supersede it with a new entry.
