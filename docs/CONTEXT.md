# Context
Verified facts about what Mandate depends on, each with how and when it was checked. Read this before touching an integration, and re-verify anything older than the code you're changing.

## Networks
| Network | API | Explorer | Notes | Verified |
|---|---|---|---|---|
| Stacks mainnet | https://api.hiro.so | https://explorer.hiro.so | Every test forks it through `[repl.remote_data]` in `Clarinet.toml` | 2026-10-13 |
| Stacks testnet | https://api.testnet.hiro.so | https://explorer.hiro.so/?chain=testnet | Reset on 2026-08-05 (block 1's time), so nothing deployed earlier survives. No canonical sBTC and no Zest (see Traps) | 2026-10-13, `/extended/v2/blocks/1` |

## Contracts we call (mainnet)
| Name | Contract | What we use | Verified how |
|---|---|---|---|
| sBTC | `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` | SIP-010 `transfer` | every fork test (E-007) |
| Zest sBTC vault | `SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-sbtc` | `deposit (amount min-out recipient)`, `redeem (amount min-out recipient)`; read-only `convert-to-shares`, `convert-to-assets` | interface and deployed source, 2026-10-13; E-002, E-004 |
| Granite borrower | `SPSX722NK9V3A8D3CVQT0CDY4EBQ3E9FSDDE61FT.borrower-v1` | `add-collateral` | E-005 |
| Granite lending pool | `SPSX722NK9V3A8D3CVQT0CDY4EBQ3E9FSDDE61FT.liquidity-provider-v1` | `deposit (assets recipient)`, which credits `contract-caller`; no `is-standard` check | deployed source, 2026-10-06 |
| Jing sBTC/STX market | `SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-2` | `deposit-token-x`, `cancel-token-x-deposit`; Clarity 5 | E-006 |
| Bitflow pools | xyk and stableswap under `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR`; DLMM under `SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD` | nothing: they refuse a contract as recipient | E-003 |
| Mandate probe (ours) | `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet` | owner-only `fund`, `allocate`, `unwind`, `rescue` | E-001, E-002 |

## SDKs and tools
| Tool | Version | Notes | Verified |
|---|---|---|---|
| clarinet CLI | 3.24.1 | the binary contains `HIRO_API_KEY` and `x-api-key`; key support untested | `clarinet --version` and binary strings, 2026-10-13 |
| @stacks/clarinet-sdk | 3.23.2 | runs the tests; `initial_height` under `[repl.remote_data]` pins a fork (`Clarinet-jing.toml`); no API key support found | `package.json` and the SDK's wasm, 2026-10-13 |
| vitest | 4.1.11 | full suite 117 s locally | E-007 |
| Node | 26 | CI uses the same major | `node -v`, 2026-10-13 |

## Traps
- **Zest takes funds from `contract-caller`.** Both `deposit` (line 765) and `redeem` (line 799) of `v0-vault-sbtc` bind `account` to `contract-caller`. A contract placed between the vault and Zest is Zest's account for that call: it pays, and it holds the funds for an instant (#5, #6). Deployed source, 2026-10-13.
- **Zest's smallest deposit.** 1 sat rounds to zero shares and fails with `(err u801010)`; 10 sats works. `tests/minimum.test.ts`, 2026-10-13.
- **Bitflow's guard sits one contract below the core.** The core contracts have no `is-standard` check on trader paths; the pools do (E-003). Reading the core alone suggests contracts are fine.
- **Granite's lending pool lends USDCx.** Posting sBTC to Granite is collateral for borrowing, a different action from lending. State-v1 balances, September 2026.
- **Jing fills need a signed Pyth update**, so they can't be tested on a fork. On 2026-10-07 v6-2 had six transactions in total, and v5 and v6 were paused.
- **Testnet** has more than a dozen tokens named sBTC from different deployers, none confirmed as official, and Zest's v2 repository has only local simnet setups, with no testnet deployment found. Token metadata API and repository tree, 2026-10-13.
- **Two SIP-010 traits.** Bitflow defines its own (`SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1`); Granite and Jing use the canonical one (`SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard`). One trait type can't cover every venue. `contracts/granite-probe.clar`.
- **`as-contract?`'s body can't end in a response.** Put `try!` inside the body. `contracts/c4probe.clar`.
- **Fork tests run at the chain tip**, except the Jing suite, so changes in mainnet state can move results.
- **Hiro rate limits.** The SDK waits 40 to 55 s and retries when rate-limited. On 2026-10-13 a local full run was limited 11 times and passed in 117 s; on GitHub's runners, 11 times and 249 s (E-008). No API key is needed for the suite to pass.

## Environment
| Name | Purpose | Where |
|---|---|---|
| `settings/Mainnet.toml` | deployer mnemonic for mainnet deploys | local only, gitignored. Never print it |
| `FORBIDDEN_WORDS` | banned words for the CI identity check | GitHub Actions secret |
