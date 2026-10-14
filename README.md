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
| Stacks testnet | Version 5 of the vault on testnet's official sBTC, with a mock yield venue. A reference delegate holding only its own key allocated and unwound under a mandate, and the vault refused four calls the mandate forbids, on the record. | E-037 |
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

Version 4 added a per-vault cap on each asset: the vault's principal across all
owners cannot exceed it. The deployer sets each cap once and can never raise it, so
the maximum exposure is fixed and readable on-chain. On mainnet the caps are
0.01 BTC of sBTC and 1,000 USDCx. Version 4 also identifies owners and delegates by
the principal that calls it directly, so a contract an owner interacts with cannot
act in the owner's name.

Version 5, the version for mainnet, closes the vault while it calls a venue: until
the call returns, every function that changes the vault's state is refused. The
structured review ([docs/REVIEW.md](docs/REVIEW.md)) found that version 4 lacked
this protection. A venue listed by
its own owner could deposit its own tokens into the vault while paying out a
withdrawal from the venue, and the vault credited those tokens twice, to the venue
and to the owner, at the expense of other owners (#48). Version 4 was only ever
deployed on testnet.

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

Version 5 of the vault is deployed on Stacks testnet and operates on testnet's
official sBTC. Zest is not available on testnet, so the yield venue is the one
stand-in: a mock venue that implements the same venue trait as Zest's vault and
holds testnet sBTC. The vault's integration with Zest's and Granite's deployed
contracts is tested separately on a mainnet fork (`tests/v5-zest-fork.test.ts`,
`tests/v5-granite-fork.test.ts`).

| Contract | Address | Deployed |
| --- | --- | --- |
| Vault, version 5 | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mandate-vault-v5` | [block 725,660](https://explorer.hiro.so/txid/0x8d97cca7121c7d5ec43fae56db34efa636fe9a6971b7488b390060026bb635b2?chain=testnet) |
| Mock venue for testnet sBTC | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-venue-sbtc` | [block 719,933](https://explorer.hiro.so/txid/0x086d9b94b07098b68399dfabc75e5716329b8f81b7a8bbb5ef8e0de4a65497c4?chain=testnet) |
| Token trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.sip-010-trait` | [block 719,259](https://explorer.hiro.so/txid/0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee?chain=testnet) |
| Venue trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.venue-trait` | [block 719,260](https://explorer.hiro.so/txid/0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b?chain=testnet) |
| sBTC, testnet's official deployment | `SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token` | [block 1,162](https://explorer.hiro.so/txid/0x158530a55b6d96a611dd0389a34410986632ca698330542cbc3fe810a3c39aa0?chain=testnet) |

Versions 4 and 3 remain deployed at
`ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mandate-vault-v4` (E-030, E-031) and
`ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mandate-vault-v3` (E-024). Neither
holds any funds, and neither is used: version 4 contains the flaw that version 5
fixes (#48).

A reference delegate (`scripts/delegate.mjs`), holding only its own key, ran four
rounds on version 5 against a mandate the owner granted it, moving toward a target
share of the owner's funds in the venue each round. Every transaction is signed by
the delegate alone, with deny-mode post-conditions that fix what the vault sends:

| Round | Action | Result | Transaction |
| --- | --- | --- | --- |
| Target 75% | Allocate 20,000 sats | `(ok u20000)` | [block 727,171](https://explorer.hiro.so/txid/0xeb0f3faeb98ae7ccc63979c37620e645bd627b0b901e7aef9931ee9a59e2c6cb?chain=testnet) |
| Target 25% | Unwind 10,000 shares | `(ok u10000)` | [block 727,173](https://explorer.hiro.so/txid/0xd6881ed3eecc1f5901497689332f5c34c7d9317781422e74661115207df070ee?chain=testnet) |
| Target 75% | Allocate 20,000 sats | `(ok u20000)` | [block 727,175](https://explorer.hiro.so/txid/0xce1c196f5af094d61ef14300aa35e559d3ad81dc1b2a624a167333f71009bdc9?chain=testnet) |
| Target 0% | Unwind 30,000 shares | `(ok u30000)` | [block 727,177](https://explorer.hiro.so/txid/0x837c5e2148d7f5ed91457e019adcacb1202a59c4730431a112c585d59697ae9e?chain=testnet) |

The delegate then attempted four calls that its mandate forbids, each signed by the
delegate alone in deny mode with no post-conditions, so that none could move an
asset even if the vault accepted it. The vault refused every one, and none emitted
an asset event:

| Attempt | Policy in force | Result | Transaction |
| --- | --- | --- | --- |
| An allocation of 20,001 sats | The per-move cap is 20,000 sats | `(err u102)` | [block 727,181](https://explorer.hiro.so/txid/0x9732ed77ee3bd662c60d3a8d5d57525517b95f8068e3d88e1817ed5ee94b20a6?chain=testnet) |
| An allocation into a venue the owner never listed | The owner listed only the testnet sBTC venue | `(err u107)` | [block 727,183](https://explorer.hiro.so/txid/0x789756a7e3ff1a1720058787e85b8078f8e03a497acf4f02fbbc1374c947083a?chain=testnet) |
| A withdrawal of 1 sat | Only an owner withdraws, from the owner's own balance | `(err u105)` | [block 727,186](https://explorer.hiro.so/txid/0x5c506e19d456730b3468ec3be2b1482f29ec3404c522b74729159758dae6356d?chain=testnet) |
| An allocation after the owner revoked the mandate | No mandate is in force | `(err u100)` | [block 727,192](https://explorer.hiro.so/txid/0x463f4c5f763d07471681b50e05b0eab96b6233d96ee89adef42a4b9069dc63ff?chain=testnet) |

The owner's only transactions were the allowlists, the deposit, the grant, the
revocation and the final withdrawal of all 40,000 sats. The records are in
`deployments/testnet-delegate.json`, `deployments/testnet-delegate-run.json` and
`deployments/testnet-refusals.json`, and every transaction is listed in
[docs/EVIDENCE.md](docs/EVIDENCE.md), entry E-037.

### Mainnet probe

Mainnet deployment of the vault is scheduled for milestone M2
([docs/PLAN.md](docs/PLAN.md)), following [MAINNET-RUNBOOK.md](MAINNET-RUNBOOK.md). A deliberately minimal probe contract is deployed on
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

**Requirements:** Node.js 26 and npm. The fork suites also need network access to
`api.hiro.so`, and the testnet test to `api.testnet.hiro.so`, through Hiro's public
API. Neither an API key nor the Clarinet CLI is required.

    git clone https://github.com/emmanuelist/mandate
    cd mandate
    npm ci
    npm test

`npm test` runs two suites. The local suites, 119 tests in 7 files, touch only local
contracts and run in seconds without a network
(`npx vitest run --config vitest.local.config.ts`). The fork suite, 41 tests in 16
files, runs against a fork of Stacks mainnet at block 9,194,000 (`initial_height` in
`Clarinet.toml`), so its results do not change as mainnet advances, and completes in
approximately 6 to 10 minutes (`npx vitest run`). Results are final only once each
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
- `npm run static`, which requires the Clarinet CLI 3.24.1, runs `clarinet check`
  on every manifest. It fails if a contract does not type-check, or if Clarinet
  raises a warning that [docs/REVIEW.md](docs/REVIEW.md) does not justify.
  Continuous integration runs it on every change.

## Deploying to testnet

The files in `deployments/` record the deployment, the lifecycle run and the
reference delegate's run described above. To verify them against the chain, without
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
4. To run the reference delegate as well, run `npm run delegate:key -- testnet` to
   create the delegate's own key, which is excluded from version control, and
   record its address. Then run `npm run testnet:mandate`, which, as the owner,
   funds a mandate with 40,000 sats of testnet sBTC and grants it to that address,
   and `npm run delegate -- testnet 7500,2500`, which runs the delegate toward each
   target in turn. `npm run delegate -- testnet attempt <kind>`, where the kind is
   `over-cap`, `unlisted-venue`, `withdraw` or `revoked`, has the delegate attempt a
   call the mandate forbids and records the refusal. `npm run testnet:mandate --
   revoke` and `npm run testnet:mandate -- exit` revoke the mandate and return all
   of the owner's funds.

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
      mandate-vault-v5.clar       The vault: v4 closed to calls back in while a venue runs, for mainnet
      mandate-vault-v4.clar       The vault as deployed on testnet for M2's runs: v3 under a per-vault AUM cap
      mandate-vault-v3.clar       The vault as deployed on testnet for M1
      venue-trait.clar            The interface the vault requires of a venue; Zest's vault conforms as deployed
      granite-venue.clar          Adapter for Granite's USDCx lending pool, the second venue
      sip-010-trait.clar          The standard token trait, included so that one source deploys on every network
      mock-venue-sbtc.clar        Stand-in yield venue holding testnet sBTC, for testnet and its fork
      mock-token.clar             Stand-in for sBTC in the tests and the earlier testnet run
      mock-venue.clar             Stand-in yield venue in the tests and the earlier testnet run
      hostile-venue.clar          An adversarial venue used in the tests
      reentrant-venue*.clar       Venues that call back into the vault mid-call, used in the tests
      mandate-vault.clar          First version, retained with its tests
      mandate-vault-v2.clar       Second version, retained with its tests
      mandate-probe-mainnet.clar  The minimal probe deployed on mainnet
      *probe.clar, venue-spike.clar   Exploratory contracts behind the venue findings
    tests/                        160 tests in 23 files, 119 local and 41 on a mainnet fork, plus the Jing and testnet fork tests
    scripts/                      Testnet deployment, execution and verification; the reference delegate; the specification and static checks
    deployments/                  Testnet deployment records
    docs/                         Specification, plan, decisions, evidence and verified dependency facts
    Clarinet*.toml                Manifests for the mainnet fork, the Jing fork, the testnet fork, the local suites and the static checks

## Documentation

| Document | Contents |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | Protocol specification: roles and assets, policy model, authorization flow, error codes, threat model and non-goals |
| [docs/REVIEW.md](docs/REVIEW.md) | The structured review: its methods, every finding with its severity and status, and every static-analysis warning with the reason it stands |
| [docs/STATE.md](docs/STATE.md) | Current status, with the verification behind each claim |
| [docs/PLAN.md](docs/PLAN.md) | Milestones and their exit criteria |
| [docs/EVIDENCE.md](docs/EVIDENCE.md) | The evidence behind each claim: transactions, CI runs and captured output |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Design decisions and their rationale |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Verified facts about the contracts and tools Mandate depends on, including known pitfalls |
| [BITFLOW-REPORT.md](BITFLOW-REPORT.md) | Analysis of why Bitflow's pools cannot pay a contract principal |
| [MAINNET-RUNBOOK.md](MAINNET-RUNBOOK.md) | The procedure for deploying the vault to mainnet, with its costs, and the record of the earlier mainnet probe |

## License

Mandate is released under the MIT License. See [LICENSE](LICENSE).
