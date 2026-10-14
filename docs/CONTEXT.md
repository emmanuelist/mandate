# Context
Verified facts about what Mandate depends on, each with how and when it was checked. Read this before touching an integration, and re-verify anything older than the code you're changing.

## Networks
| Network | API | Explorer | Notes | Verified |
|---|---|---|---|---|
| Stacks mainnet | https://api.hiro.so | https://explorer.hiro.so | Every test forks it through `[repl.remote_data]`, at the block pinned by `initial_height` | 2026-10-13 |
| Stacks testnet | https://api.testnet.hiro.so | https://explorer.hiro.so/?chain=testnet | Reset on 2026-08-05 (block 1's time), so nothing deployed earlier survives. No Zest and no standard SIP-010 trait (see Traps). sBTC is `SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token`. Accepts Clarity 4 contracts | 2026-10-13, `/extended/v2/blocks/1`; 2026-10-14, our deploys (E-017) and the sBTC deployment |

## Contracts we call (mainnet)
| Name | Contract | What we use | Verified how |
|---|---|---|---|
| sBTC | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` | SIP-010 `transfer` | every fork test (E-007) |
| Zest sBTC vault | `SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-sbtc` | `deposit (amount min-out recipient)`, `redeem (amount min-out recipient)`; read-only `convert-to-shares`, `convert-to-assets`, `get-balance` | interface and deployed source, 2026-10-13; E-002, E-004 |
| Zest's own traits | `SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.vault-traits` | `v0-vault-sbtc` declares `tokenized-vault` (line 9): SIP-010 functions plus `get-assets`, `convert-to-shares`, `convert-to-assets`, `deposit`, `redeem` | deployed source, 2026-10-13 |
| Zest shares | `zft`, defined in `v0-vault-sbtc` | SIP-010 `transfer (amount from to memo)`, which accepts `tx-sender` or `contract-caller` as `from` | deployed source, 2026-10-13 |
| Granite borrower | `SPSX722NK9V3A8D3CVQT0CDY4EBQ3E9FSDDE61FT.borrower-v1` | `add-collateral` | E-005 |
| Granite lending pool | `SPSX722NK9V3A8D3CVQT0CDY4EBQ3E9FSDDE61FT.liquidity-provider-v1` | `deposit (assets recipient)`, which credits `contract-caller`; no `is-standard` check | deployed source, 2026-10-06 |
| Jing sBTC/STX market | `SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-2` | `deposit-token-x`, `cancel-token-x-deposit`; Clarity 5 | E-006 |
| Bitflow pools | xyk and stableswap under `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR`; DLMM under `SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD` | nothing: they refuse a contract as recipient | E-003 |
| Mandate probe (ours) | `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet` | owner-only `fund`, `allocate`, `unwind`, `rescue` | E-001, E-002 |

## Our contracts on testnet
Deployed by `npm run testnet` from account 1 of `settings/Testnet.toml` and recorded in `deployments/testnet.json`. `npm run testnet:verify` checks each one's source and Clarity version against the repo, with no keys.

| Contract | Clarity | Block | Verified |
|---|---|---|---|
| `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.sip-010-trait` | 4 | 719,259 | `npm run testnet:verify`, 2026-10-14 (E-017) |
| `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.venue-trait` | 4 | 719,260 | same |
| `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-token` (mock sBTC) | 3 | 719,263 | same |
| `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-venue` | 4 | 719,265 | same |
| `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mandate-vault-v3` | 4 | 719,267 | same |

## SDKs and tools
| Tool | Version | Notes | Verified |
|---|---|---|---|
| clarinet CLI | 3.24.1 | the binary contains `HIRO_API_KEY` and `x-api-key`; key support untested | `clarinet --version` and binary strings, 2026-10-13 |
| @stacks/clarinet-sdk | 3.23.2 | runs the tests; `initial_height` under `[repl.remote_data]` pins a fork (`Clarinet-jing.toml`); no API key support found | `package.json` and the SDK's wasm, 2026-10-13 |
| vitest-environment-clarinet | 3.0.2, the latest | the `clarinet` test environment. Sets both `transformMode` (for Vitest 3) and `viteEnvironment: "ssr"`, so Vitest 4 warns that `transformMode` is deprecated and then uses `viteEnvironment`. The warning prints in passing runs too and is harmless | its `index.js` and Vitest's `init` chunk; 18 warnings in each green CI run, 2026-10-14 |
| vitest | 4.1.11 | full suite 117 s locally | E-007 |
| Node | 26 | CI uses the same major | `node -v`, 2026-10-13 |
| @stacks/transactions | 7.6.0 | `makeContractDeploy` with `clarityVersion` (the `ClarityVersion` values are the integers in `Clarinet.toml`), `makeContractCall`, `makeSTXTokenTransfer`, `broadcastTransaction({ transaction, network })`, `fetchNonce`, `fetchCallReadOnlyFunction` | the testnet runs, 2026-10-14 (E-018) |
| @stacks/wallet-sdk | 7.6.0 | `generateWallet({ secretKey, password })`, `generateNewAccount`, `getStxAddress(account, "testnet")` | same |

## Traps
- **Zest takes funds from `contract-caller`.** Both `deposit` (line 765) and `redeem` (line 799) of `v0-vault-sbtc` bind `account` to `contract-caller`. A contract placed between the vault and Zest is Zest's account for that call: it pays, and it holds the funds for an instant (#5, #6). Deployed source, 2026-10-13.
- **Zest fills exactly at its quote within a call:** `deposit` returns what `convert-to-shares` quoted and `redeem` what `convert-to-assets` quoted, so a zero-slippage mandate works on Zest. A 100,000-sat round trip returns 99,999: share rounding, not a fee. E-011.
- **Zest's smallest deposit.** 1 sat rounds to zero shares and fails with `(err u801010)`; 10 sats works. `tests/minimum.test.ts`, 2026-10-13.
- **Bitflow's guard sits one contract below the core.** The core contracts have no `is-standard` check on trader paths; the pools do (E-003). Reading the core alone suggests contracts are fine.
- **Granite's lending pool lends USDCx.** Posting sBTC to Granite is collateral for borrowing, a different action from lending. State-v1 balances, September 2026.
- **Jing fills need a signed Pyth update**, so they can't be tested on a fork. On 2026-10-07 v6-2 had six transactions in total, and v5 and v6 were paused.
- **Testnet has an official sBTC among more than a dozen look-alikes:** `SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token`. The network table at docs.stacks.co ("Mainnet and Testnets") names it, its deployer also deployed `sbtc-registry`, `sbtc-deposit` and `sbtc-withdrawal`, it has `protocol-mint` and the seven SIP-010 functions, and it was deployed at block 1,162 on 2026-08-06, the day after the reset. On 2026-10-14 it had 98 holders. The Hiro Platform faucet hands out testnet sBTC. An earlier entry here said none of the testnet tokens was official; that was wrong. Contract API, 2026-10-14.
- **Testnet has no Zest:** Zest's v2 repository has only local simnet setups, with no testnet deployment found. Repository tree, 2026-10-13.
- **Testnet has no standard SIP-010 trait.** The reset erased it: `sip-010-trait-ft-standard` under `ST3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8NQXMNRQ` (mainnet's deployer, on testnet) and under `ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT` both answer 404, so a contract that names it can't deploy there. The vault carries its own copy (D-014). `/v2/contracts/interface`, 2026-10-14.
- **A testnet contract can't be redeployed under the same name.** `npm run testnet` skips a contract that's already deployed only if its source is identical to the repo's, and otherwise stops before sending anything. A changed contract needs a fresh testnet account (a new seed in `settings/Testnet.toml`). Tested by editing a contract locally, 2026-10-14.
- **Two SIP-010 traits.** Bitflow defines its own (`SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1`); Granite and Jing use the canonical one (`SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard`). One trait type can't cover every venue. `contracts/granite-probe.clar`.
- **Trait conformance is structural.** A contract can be passed as a trait it never declares if its functions match: Zest's vault as Mandate's venue trait (E-009), and sBTC as Bitflow's SIP-010 trait in v2's tests.
- **An `as-contract?` allowance on the venue's own token covers the venue burning the vault's shares on redeem** (`with-ft <venue> "*" <shares>`). E-009.
- **Only four devnet accounts exist:** `deployer` and `wallet_1` to `wallet_3` (`settings/Devnet.toml`). Tests that need a stranger reuse `wallet_2`.
- **An exceeded `as-contract?` allowance fails the call with `(err u<n>)`**, where n is the violated allowance's position in the list, so the vault's single allowance gives `(err u0)`. E-012.
- **Clarity doesn't block re-entrancy.** A venue can call back into the vault mid-call. The call runs as the vault (inside its `as-contract?`, `tx-sender` is the vault), which owns no balances, positions or mandates, so it fails: `(err u105)` from `withdraw`. E-012, D-011.
- **`as-contract?`'s body can't end in a response.** Put `try!` inside the body. `contracts/c4probe.clar`.
- **Forking at the tip crashes the SDK now and then.** The SDK reads the tip height, then asks Hiro for that block; a lagging API node answers 404 "Block not found", and the SDK panics instead of retrying (`remote_data/mod.rs:281`, a `Result::unwrap()`), killing the worker. Seen in CI on 2026-10-13. The forks are pinned to settled blocks instead (D-012).
- **Upgrading the SDK doesn't change forking:** between 3.23.2 and 3.24.1, 36 commits changed 175 files and none of the forking code. In 3.24.1, `remote_data/mod.rs` still unwraps `/v2/info` (line 237) and the block fetch (line 281); rate limits (429) are retried in the HTTP helper, any other error still panics. `gh api repos/stx-labs/clarinet/compare/v3.23.2...v3.24.1` and the file at v3.24.1, 2026-10-14.
- **The SDK also panics when a fetch fails outright**, pinned block or not: `remote_data/mod.rs:237`, `Result::unwrap()` on "fetch failed". It cost one file in the first attempt of #20's CI run ([38485977559](https://github.com/emmanuelist/mandate/actions/runs/38485977559)); the second attempt passed (D-013).
- **Many workers at once: some fail to start.** With Vitest's default worker count, 3 of 17 files failed to start at the pinned block (local, 2026-10-13); each passed alone, and the full suite passed with two workers (E-013). The cause is inferred, not proven: every worker boots its own fork from Hiro at the same moment.
- **Vitest 4 ignores `poolOptions`**, so `singleFork` never took effect; the worker count is the top-level `maxWorkers`.
- **The SDK caches fork data in `.cache/datastore`**, one entry per contract, key and block. With that cache restored in CI, #17 failed the same two tests twice, with runtime type errors inside Zest's (`v0-vault-sbtc:482`) and Bitflow's (`xyk-core-v-1-2:566`) forked contracts. Without it, #19 still failed, two workers not starting right after a burst of rate-limit waits. CI no longer caches it, and retries the fork suites instead (D-013).
- **A fork worker started inside Hiro's rate-limit window can fail to start at once**, printing only `[vitest-pool]: Failed to start forks worker` and no panic. On `main` after #21 the Jing suite failed three times in 2.6 s, starting 3 s after Hiro had told the runner to wait 29 and 53 s. In the rerun it also started inside a window but its worker came up, and the SDK waited out the rate limit (E-020). Hiro's waits in our logs run from 1 to 57 s, so a CI retry waits 60 s (D-015).
- **npm 11 skips install scripts it has not been told to allow**, and warns about `fsevents@2.3.3`, an optional macOS file-watching dependency. `vitest run` does not use it, and CI's Linux runners do not install it. Fresh clone, 2026-10-14 (E-022).
- **Rate-limit waits are routine:** CI runs on 2026-10-13 hit Hiro's limit 11 to 13 times each, local runs 1 to 11. Only CI has failed with two workers. The SDK has no setting for an API key.
- **Fork tests run at pinned blocks:** the main suite at 9,194,000 (2026-10-13 06:41 UTC) and the Jing suite at 9,036,500. A mainnet change after those blocks doesn't show until the height is bumped on purpose (D-012).
- **Hiro rate limits.** The SDK waits 40 to 55 s and retries when rate-limited. On 2026-10-13 a local full run was limited 11 times and passed in 117 s; on GitHub's runners, 11 times and 249 s (E-008). No API key is needed for the suite to pass.

## Environment
| Name | Purpose | Where |
|---|---|---|
| `settings/Mainnet.toml` | deployer mnemonic for mainnet deploys | local only, gitignored. Never print it |
| `settings/Testnet.toml` | a testnet-only seed for `npm run testnet`: account 1 deploys and owns, account 2 is the delegate | local only, gitignored. Never print it |
| `FORBIDDEN_WORDS` | banned words for the CI identity check | GitHub Actions secret |
