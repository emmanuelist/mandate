# Mandate

Mandate is a non-custodial vault for sBTC on Stacks. It allows an owner to appoint
a delegate, such as an asset manager, a trading desk or an autonomous agent, to
manage the owner's sBTC within limits that the vault contract enforces on-chain.

The delegate may move funds only between venues the owner has approved, and can
never withdraw them. The owner may revoke the delegation in any block, and every
withdrawal is paid to the owner alone.

Mandate brings the investment mandate, the arrangement on which professional asset
management is built, to Bitcoin capital on Stacks, with its terms enforced by the
chain rather than by contract law.

## Motivation

Stacks already offers established venues for Bitcoin capital. Zest and Granite hold
most of the ecosystem's lending capital, and PoX-5 distributes staking rewards in
sBTC. What Stacks lacks is a way to place that capital under another party's
management without surrendering custody. Delegation currently requires handing over
private keys, so in practice capital is not delegated, and managed strategies are
confined to their managers' own balance sheets.

## Status

| Network | Deployment | Evidence |
| --- | --- | --- |
| Stacks testnet | The complete vault, with a mock sBTC token and a mock yield venue. One mandate executed end to end. | E-017 to E-019 |
| Stacks mainnet, forked | The vault tested against Zest's deployed sBTC vault. The full test suite runs in continuous integration. | E-011, E-021 |
| Stacks mainnet | A minimal probe contract that deposited sBTC into Zest and withdrew it. | E-001, E-002 |

Evidence entries are recorded in [docs/EVIDENCE.md](docs/EVIDENCE.md).

## Policy model

Every constraint is an integer comparison against on-chain state. No price oracle
is involved.

| Constraint | Protects against |
| --- | --- |
| Asset allowlist, per owner | The delegate converting holdings into a token it controls |
| Venue allowlist, per owner | Allocation into a protocol the delegate controls |
| Per-allocation notional cap | A single catastrophic reallocation |
| Rate limit over a window of Bitcoin blocks | Repeated reallocation that consumes fees without changing the position |
| Rolling daily notional cap | Gradual churn beneath the per-allocation cap |
| Minimum-output floor | Execution at a share price worse than the mandate permits |
| Cumulative slippage budget | Erosion of the position through a series of poor fills |
| Expiry | A dormant delegate continuing to act indefinitely |

The minimum-output floor is derived from an on-chain quote rather than supplied by
the caller. A delegate able to set its own floor could circumvent the other limits.

The vault also verifies every venue interaction against its own token and share
balances instead of relying on the amounts the venue reports, and rejects the
interaction if they disagree.

The full specification, including the order of every check, the error codes and
the threat model, is in [docs/SPEC.md](docs/SPEC.md).

## Venue compatibility

Each venue was verified against its deployed mainnet contracts on a Clarinet
remote-data fork.

| Venue | Accepts a contract principal | Notes |
| --- | --- | --- |
| Zest | Yes | Binds `contract-caller`; applies no `is-standard` check to recipients |
| Granite | Yes | Same pattern; `liquidity-provider-v1` applies no `is-standard` check |
| Bitflow | No | `pool-transfer` asserts `(is-standard recipient)` |

Bitflow's pools cannot pay a contract principal. The same check appears in the xyk
pool, both stableswap pools and the DLMM pools, and in `pool-mint` and `pool-burn`,
which also rules out liquidity provision by a contract. Deployed Clarity contracts
are immutable, so this restriction is permanent.
[BITFLOW-REPORT.md](BITFLOW-REPORT.md) documents the finding in full.

This finding is the reason Mandate allocates to lending venues rather than trading
on a decentralized exchange.

## Deployments

### Testnet

The complete vault is deployed on Stacks testnet. Zest is not available on testnet,
so the deployment uses a mock yield venue that implements the same venue trait as
Zest's vault, together with a mock token in place of sBTC. The vault's integration
with Zest's deployed contract is tested separately on a mainnet fork
(`tests/v3-zest-fork.test.ts`).

| Contract | Address | Deployed |
| --- | --- | --- |
| Vault | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mandate-vault-v3` | [block 719,267](https://explorer.hiro.so/txid/0x26400b07e407980984c89c9da2cf61ff469202e4c14eb97af4241e3a91700ce6?chain=testnet) |
| Mock sBTC | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-token` | [block 719,263](https://explorer.hiro.so/txid/0xa9ff4fbe791268326039434dfa0222333bf3a8717efcef0ab76db5dd463c2a6e?chain=testnet) |
| Mock venue | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-venue` | [block 719,265](https://explorer.hiro.so/txid/0xc9de22d0954b5f53fa05c5ca1ea8451b258bd4790aad4e8929b32200ef0f6439?chain=testnet) |
| Token trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.sip-010-trait` | [block 719,259](https://explorer.hiro.so/txid/0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee?chain=testnet) |
| Venue trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.venue-trait` | [block 719,260](https://explorer.hiro.so/txid/0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b?chain=testnet) |

The end-to-end run of one mandate, one transaction per step, as recorded in
`deployments/testnet-run.json`:

| Step | Result | Transaction |
| --- | --- | --- |
| Owner deposits 400,000 | `(ok true)` | [block 719,376](https://explorer.hiro.so/txid/0x1b7330937d2c0d4dfec50d2023302223b9e6fc6b86dbb345ffbab22bf7852d0f?chain=testnet) |
| Owner grants the delegate a mandate | `(ok true)` | [block 719,378](https://explorer.hiro.so/txid/0xfb677877d675498fe0dfccd0f95f654aa576c9c81bb34b64eece2f315ae8c673?chain=testnet) |
| Delegate allocates 100,000 to the venue | `(ok u100000)` | [block 719,382](https://explorer.hiro.so/txid/0x73924838982ced49643ec0e3710b712b624fb140ed7e5e33e734a9eeb431e03f?chain=testnet) |
| Delegate unwinds the position | `(ok u100000)` | [block 719,384](https://explorer.hiro.so/txid/0x43bad4af1df7ee5f48df87a9cf9b7a8f89a2981ef99f97b53248d1c5e536f2ab?chain=testnet) |
| Owner withdraws 400,000 | `(ok true)` | [block 719,385](https://explorer.hiro.so/txid/0x1f978cfe8c63bd739e09495ca52f93b412bed98d60998ace774fa2e795cf7af5?chain=testnet) |

After the run, the vault holds none of the owner's tokens and the owner's wallet
holds all of them. The setup transactions and every transaction hash are listed in
[docs/EVIDENCE.md](docs/EVIDENCE.md), entries E-017 to E-019.

### Mainnet probe

Mainnet deployment of the vault is scheduled for milestone M2
([docs/PLAN.md](docs/PLAN.md)). A deliberately minimal probe contract is deployed on
mainnet today. It demonstrated that a Clarity contract can deposit real sBTC into
Zest and withdraw it:

| Call | Result | Transaction |
| --- | --- | --- |
| `fund` | `(ok true)` | [block 8,879,077](https://explorer.hiro.so/txid/0x8251abef4b4c76dc588c54722098f0fdc8860157602cf501e0815f2036b03df6?chain=mainnet) |
| `allocate` | `(ok u99)` | [block 8,879,080](https://explorer.hiro.so/txid/0x8fa8b392a30e7786860e187a7c0cf62e5aa812150dbb0bfec1c324bd9e7fa121?chain=mainnet) |
| `unwind` | `(ok u99)` | [block 8,879,083](https://explorer.hiro.so/txid/0xfc168e4b2b7b9037742f240ac2624c64ce9ad14ac4959f16fd82996f0640695e?chain=mainnet) |
| `rescue` | `(ok true)` | [block 8,879,085](https://explorer.hiro.so/txid/0xd9dda0d85334e5cac65445927b0bc9e5611db578ba73afe8a5d7b87f7049a074?chain=mainnet) |

The `allocate` call is the significant result: the contract deposited real sBTC
into Zest's mainnet vault and received vault shares in return. After the final
call, the contract held no sBTC and no shares. The exercise, including deployment,
cost 0.405 STX in transaction fees.

Contract: `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet`, deployed in
[block 8,878,880](https://explorer.hiro.so/txid/0x77489c3697c99efd83ada94c9ebbd681b26d07b21949c842d28386a671a42ebc?chain=mainnet).

## Running the test suite

**Requirements:** Node.js 26 and npm, and network access to `api.hiro.so`. Every
test runs against a fork of Stacks mainnet served by Hiro's public API. Neither an
API key nor the Clarinet CLI is required.

    git clone https://github.com/emmanuelist/mandate
    cd mandate
    npm ci
    npx vitest run

The full suite comprises 73 tests in 17 files and completes in approximately 6 to 8
minutes. It forks mainnet at block 9,194,000 (`initial_height` in `Clarinet.toml`),
so results do not change as mainnet advances. Results are final only once the
summary line has been printed.

The Jing test forks an earlier block, 9,036,500, from a separate manifest, and runs
on its own:

    npx vitest run --config vitest.jing.config.ts

Operational notes:

- Hiro rate-limits its public API. Messages such as `Rate limited, retrying after
  53 seconds...` indicate that the test SDK is waiting and will retry
  automatically.
- Occasionally a test worker fails to start (`Failed to start forks worker`), or
  the SDK aborts on a failed request. These failures originate in the network
  rather than in the code. Wait one minute and run the suite again. Continuous
  integration follows the same policy, with up to three attempts one minute apart.
- A warning that the Vitest environment `clarinet` defines `transformMode`
  originates in Hiro's test environment package and does not affect the results.
- `clarinet check` (Clarinet CLI 3.24.1) type-checks the contracts. If it asks
  whether to overwrite the simnet deployment plan, answer Y. The plan is a
  generated file and is not tracked.

## Deploying to testnet

The files `deployments/testnet.json` and `deployments/testnet-run.json` record the
deployment and the run described above. To verify them against the chain, without
any keys:

    npm run testnet:verify

To deploy an independent copy and run the same lifecycle:

1. Create `settings/Testnet.toml` containing a single line,
   `mnemonic = "<your seed words>"`. Use a seed reserved for testnet; the file is
   excluded from version control. The seed's first account deploys the contracts
   and acts as the owner, and its second account acts as the delegate.
2. Run `npm run testnet:accounts` to display both addresses, then fund the first
   account with at least 8.11 testnet STX from a faucet (see
   [testnet faucets](https://docs.stacks.co/learn/network-fundamentals/mainnet-and-testnets)).
3. Run `npm run testnet`. The script deploys the five contracts, executes one
   mandate end to end, confirms that the balances reconcile and writes the records
   to `deployments/`. Contracts already deployed with identical source are skipped.

## Known limitations

- **SIP-010 tokens only.** The vault cannot hold native STX, which would require a
  different allowance mechanism. sBTC is a SIP-010 token, as is every asset
  accepted by the venues currently in scope (D-016).
- **Venue share ledgers are trusted.** The vault verifies token balances against
  the token contract, which the venue does not control. Venue shares, however,
  exist only in the venue's own ledger, so a venue that misreports its ledger
  consistently cannot be detected by measurement. The owner's venue allowlist is
  the safeguard against this risk (D-011).
- **The testnet deployment uses mock contracts** (D-004). The vault's integration
  with Zest's deployed contract is tested on a mainnet fork instead.
- **Jing settlement is untested.** Fills require a signed Pyth price update, which
  cannot be produced on a fork.

## Repository layout

    contracts/
      mandate-vault-v3.clar       The vault
      venue-trait.clar            The interface the vault requires of a venue; Zest's vault conforms as deployed
      sip-010-trait.clar          The standard token trait, included so that one source deploys on every network
      mock-token.clar             Stand-in for sBTC on testnet and in the tests
      mock-venue.clar             Stand-in yield venue on testnet and in the tests
      hostile-venue.clar          An adversarial venue used in the tests
      mandate-vault.clar          First version, retained with its tests
      mandate-vault-v2.clar       Second version, retained with its tests
      mandate-probe-mainnet.clar  The minimal probe deployed on mainnet
      *probe.clar, venue-spike.clar   Exploratory contracts behind the venue findings
    tests/                        73 tests in 17 files, plus the Jing fork test
    scripts/                      Testnet deployment, execution and verification; the specification check
    deployments/                  Testnet deployment records
    docs/                         Specification, plan, decisions, evidence and verified dependency facts

## Documentation

| Document | Contents |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | Protocol specification: roles and assets, policy model, authorization flow, error codes, threat model and non-goals |
| [docs/STATE.md](docs/STATE.md) | Current status, with the verification behind each claim |
| [docs/PLAN.md](docs/PLAN.md) | Milestones and their exit criteria |
| [docs/EVIDENCE.md](docs/EVIDENCE.md) | The evidence behind each claim: transactions, CI runs and captured output |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Design decisions and their rationale |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Verified facts about the contracts and tools Mandate depends on, including known pitfalls |
| [BITFLOW-REPORT.md](BITFLOW-REPORT.md) | Analysis of why Bitflow's pools cannot pay a contract principal |
| [MAINNET-RUNBOOK.md](MAINNET-RUNBOOK.md) | The procedure used to deploy and exercise the mainnet probe |

## License

Mandate is released under the MIT License. See [LICENSE](LICENSE).
