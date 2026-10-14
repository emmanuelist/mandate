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
| Stacks testnet | The complete vault on testnet's official sBTC, with a mock yield venue. One mandate executed end to end. | E-023, E-024 |
| Stacks mainnet, forked | The vault tested against Zest's sBTC vault and, through an adapter, Granite's USDCx lending pool. The full test suite runs in continuous integration. | E-011, E-028 |
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

Version 4, the version for mainnet, adds a per-vault cap on each asset: the
vault's principal across all owners cannot exceed it. The deployer sets each cap
once and can never raise it, so the maximum exposure is fixed and readable
on-chain. On mainnet the caps are 0.01 BTC of sBTC and 1,000 USDCx. Version 4 also identifies owners
and delegates by the principal that calls it directly, so a contract an owner
interacts with cannot act in the owner's name.

The full specification, including the order of every check, the error codes and
the threat model, is in [docs/SPEC.md](docs/SPEC.md).

## Venue compatibility

Each venue was verified against its deployed mainnet contracts on a Clarinet
remote-data fork.

| Venue | Accepts a contract principal | Notes |
| --- | --- | --- |
| Zest | Yes | Binds `contract-caller`; applies no `is-standard` check to recipients |
| Granite | Yes, through an adapter | Its USDCx lending pool burns LP tokens from the caller on redeem, so `granite-venue` holds them and mints its own shares (D-020) |
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

The complete vault is deployed on Stacks testnet and operates on testnet's official
sBTC. Zest is not available on testnet, so the yield venue is the one stand-in: a
mock venue that implements the same venue trait as Zest's vault and holds testnet
sBTC. The vault's integration with Zest's deployed contract is tested separately on
a mainnet fork (`tests/v3-zest-fork.test.ts`).

| Contract | Address | Deployed |
| --- | --- | --- |
| Vault | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mandate-vault-v3` | [block 719,267](https://explorer.hiro.so/txid/0x26400b07e407980984c89c9da2cf61ff469202e4c14eb97af4241e3a91700ce6?chain=testnet) |
| Mock venue for testnet sBTC | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-venue-sbtc` | [block 719,933](https://explorer.hiro.so/txid/0x086d9b94b07098b68399dfabc75e5716329b8f81b7a8bbb5ef8e0de4a65497c4?chain=testnet) |
| Token trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.sip-010-trait` | [block 719,259](https://explorer.hiro.so/txid/0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee?chain=testnet) |
| Venue trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.venue-trait` | [block 719,260](https://explorer.hiro.so/txid/0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b?chain=testnet) |
| sBTC, testnet's official deployment | `SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token` | [block 1,162](https://explorer.hiro.so/txid/0x158530a55b6d96a611dd0389a34410986632ca698330542cbc3fe810a3c39aa0?chain=testnet) |

The end-to-end run of one mandate with testnet sBTC, one transaction per step, as
recorded in `deployments/testnet-run.json`:

| Step | Result | Transaction |
| --- | --- | --- |
| Owner deposits 20,000 sats | `(ok true)` | [block 719,939](https://explorer.hiro.so/txid/0xd210c8dd03fa8051bbd01d00082f883b76c5997c6b64d24f75a46b210bb75de5?chain=testnet) |
| Owner grants the delegate a mandate | `(ok true)` | [block 719,941](https://explorer.hiro.so/txid/0x085c254f86569275e8bfa0cac65152a84875dde97ea676d55cc801159a25fbf9?chain=testnet) |
| Delegate allocates 10,000 sats to the venue | `(ok u10000)` | [block 719,943](https://explorer.hiro.so/txid/0x1f5c17e483098fdbd11fe14f7f083b50d02febc1c5efdb81ba9e0faad63edbf4?chain=testnet) |
| Delegate unwinds the position | `(ok u10000)` | [block 719,945](https://explorer.hiro.so/txid/0xa7be818fc0711f31c6f372f1e7755e3506d8dcd0c4122f84b1c330d57fd815b6?chain=testnet) |
| Owner withdraws 20,000 sats | `(ok true)` | [block 719,947](https://explorer.hiro.so/txid/0xbf277b197ad41ffc5816129ebc3c2463f7954d6baeba25b3b89d3599333f061a?chain=testnet) |

The sBTC transfer events record each movement: owner to vault, vault to venue,
venue to vault and vault to owner. After the run, the vault and the venue hold none
of the owner's sBTC, and the owner's wallet holds all of it. The setup transactions
and every transaction hash are listed in [docs/EVIDENCE.md](docs/EVIDENCE.md), entry
E-024. An earlier run, made before testnet's official sBTC was identified, used a
mock token in its place (E-017 to E-019).

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

**Requirements:** Node.js 26 and npm, and network access to `api.hiro.so`, and to
`api.testnet.hiro.so` for the testnet test. Every test runs against a fork of a
Stacks network served by Hiro's public API. Neither an API key nor the Clarinet CLI
is required.

    git clone https://github.com/emmanuelist/mandate
    cd mandate
    npm ci
    npx vitest run

The full suite comprises 127 tests in 20 files and completes in approximately 6 to 9
minutes. It forks mainnet at block 9,194,000 (`initial_height` in `Clarinet.toml`),
so results do not change as mainnet advances. Results are final only once the
summary line has been printed.

The Jing test forks an earlier block, 9,036,500, from a separate manifest, and runs
on its own:

    npx vitest run --config vitest.jing.config.ts

The testnet test forks Stacks testnet at block 719,800, from a third manifest, and
runs the vault and the testnet venue against testnet's official sBTC:

    npx vitest run --config vitest.testnet.config.ts

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
2. Run `npm run testnet:accounts` to display both addresses and their balances,
   then fund the first account with at least 7.51 testnet STX and 20,000 sats of
   testnet sBTC. The [Hiro Platform faucet](https://platform.hiro.so/faucet)
   provides both; it sends testnet sBTC 10,000 sats at a time, so two requests
   cover the run.
3. Run `npm run testnet`. The script deploys the four contracts listed in
   `Clarinet-testnet.toml`, executes one mandate end to end with testnet sBTC,
   confirms that the balances reconcile and writes the records to `deployments/`.
   Contracts already deployed with identical source are skipped, and the sBTC
   returns to the owner at the end of the run.

## Known limitations

- **SIP-010 tokens only.** The vault cannot hold native STX, which would require a
  different allowance mechanism. sBTC is a SIP-010 token, as is every asset
  accepted by the venues currently in scope (D-016).
- **Venue share ledgers are trusted.** The vault verifies token balances against
  the token contract, which the venue does not control. Venue shares, however,
  exist only in the venue's own ledger, so a venue that misreports its ledger
  consistently cannot be detected by measurement. The owner's venue allowlist is
  the safeguard against this risk (D-011).
- **The testnet venue is a stand-in** (D-017). Zest is not available on testnet, so
  the testnet run uses a mock venue holding testnet's official sBTC. The vault's
  integration with Zest's deployed contract is tested on a mainnet fork instead.
- **Jing settlement is untested.** Fills require a signed Pyth price update, which
  cannot be produced on a fork.

## Repository layout

    contracts/
      mandate-vault-v4.clar       The vault: v3 under a per-vault AUM cap, the version for mainnet
      mandate-vault-v3.clar       The vault as deployed on testnet for M1
      venue-trait.clar            The interface the vault requires of a venue; Zest's vault conforms as deployed
      granite-venue.clar          Adapter for Granite's USDCx lending pool, the second venue
      sip-010-trait.clar          The standard token trait, included so that one source deploys on every network
      mock-venue-sbtc.clar        Stand-in yield venue holding testnet sBTC, for testnet and its fork
      mock-token.clar             Stand-in for sBTC in the tests and the earlier testnet run
      mock-venue.clar             Stand-in yield venue in the tests and the earlier testnet run
      hostile-venue.clar          An adversarial venue used in the tests
      mandate-vault.clar          First version, retained with its tests
      mandate-vault-v2.clar       Second version, retained with its tests
      mandate-probe-mainnet.clar  The minimal probe deployed on mainnet
      *probe.clar, venue-spike.clar   Exploratory contracts behind the venue findings
    tests/                        127 tests in 20 files, plus the Jing and testnet fork tests
    scripts/                      Testnet deployment, execution and verification; the specification check
    deployments/                  Testnet deployment records
    docs/                         Specification, plan, decisions, evidence and verified dependency facts
    Clarinet*.toml                Manifests for the mainnet fork, the Jing fork and the testnet fork

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
