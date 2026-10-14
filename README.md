# Mandate

A non-custodial Clarity vault that lets an owner put someone else in charge of
their sBTC, whether a manager, a desk or an autonomous agent, inside limits the
chain enforces.

The delegate can move funds between allowlisted yield venues and nothing else. It
can never withdraw. The owner can revoke in any block, and withdrawal pays the
owner and nobody else.

This is the instrument asset management already runs on, expressed in Clarity and
enforced by the chain rather than by contract law.

## Why

Stacks has the places to put Bitcoin. Zest and Granite hold most of the
ecosystem's lending capital, and PoX-5 now pays staking rewards in sBTC. It has no
way to put someone *else* in charge of capital sitting in them. Delegation means
handing over keys, so in practice nobody delegates and every managed strategy runs
on its manager's own balance sheet.

## Testnet

The full vault runs on Stacks testnet. Testnet has no Zest, so the run uses a mock
yield venue behind the same venue trait Zest satisfies, and a mock token in place
of sBTC. The vault against Zest's real contract is tested on a mainnet fork
(`tests/v3-zest-fork.test.ts`).

| Contract | Address | Deployed |
|----------|---------|----------|
| Vault | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mandate-vault-v3` | [block 719,267](https://explorer.hiro.so/txid/0x26400b07e407980984c89c9da2cf61ff469202e4c14eb97af4241e3a91700ce6?chain=testnet) |
| Mock sBTC | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-token` | [block 719,263](https://explorer.hiro.so/txid/0xa9ff4fbe791268326039434dfa0222333bf3a8717efcef0ab76db5dd463c2a6e?chain=testnet) |
| Mock venue | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-venue` | [block 719,265](https://explorer.hiro.so/txid/0xc9de22d0954b5f53fa05c5ca1ea8451b258bd4790aad4e8929b32200ef0f6439?chain=testnet) |
| Token trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.sip-010-trait` | [block 719,259](https://explorer.hiro.so/txid/0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee?chain=testnet) |
| Venue trait | `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.venue-trait` | [block 719,260](https://explorer.hiro.so/txid/0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b?chain=testnet) |

One mandate, end to end, one transaction per step (the run recorded in
`deployments/testnet-run.json`):

| Step | Result | Transaction |
|------|--------|-------------|
| Owner deposits 400,000 | `(ok true)` | [block 719,376](https://explorer.hiro.so/txid/0x1b7330937d2c0d4dfec50d2023302223b9e6fc6b86dbb345ffbab22bf7852d0f?chain=testnet) |
| Owner grants the delegate a mandate | `(ok true)` | [block 719,378](https://explorer.hiro.so/txid/0xfb677877d675498fe0dfccd0f95f654aa576c9c81bb34b64eece2f315ae8c673?chain=testnet) |
| Delegate allocates 100,000 to the venue | `(ok u100000)` | [block 719,382](https://explorer.hiro.so/txid/0x73924838982ced49643ec0e3710b712b624fb140ed7e5e33e734a9eeb431e03f?chain=testnet) |
| Delegate unwinds the position | `(ok u100000)` | [block 719,384](https://explorer.hiro.so/txid/0x43bad4af1df7ee5f48df87a9cf9b7a8f89a2981ef99f97b53248d1c5e536f2ab?chain=testnet) |
| Owner withdraws all 400,000 | `(ok true)` | [block 719,385](https://explorer.hiro.so/txid/0x1f978cfe8c63bd739e09495ca52f93b412bed98d60998ace774fa2e795cf7af5?chain=testnet) |

Afterwards the vault holds none of the owner's tokens and the owner's wallet holds
all of them. The setup steps and every hash are in
[docs/EVIDENCE.md](docs/EVIDENCE.md) (E-017 to E-019).

## Mainnet

The vault goes to mainnet in M2 ([docs/PLAN.md](docs/PLAN.md)). On mainnet now is a
deliberately minimal probe contract, which showed that a Clarity contract can put
real sBTC into Zest and take it back out:

| Call | Result | Transaction |
|------|--------|-------------|
| `fund` | `(ok true)` | [block 8,879,077](https://explorer.hiro.so/txid/0x8251abef4b4c76dc588c54722098f0fdc8860157602cf501e0815f2036b03df6?chain=mainnet) |
| `allocate` | `(ok u99)` | [block 8,879,080](https://explorer.hiro.so/txid/0x8fa8b392a30e7786860e187a7c0cf62e5aa812150dbb0bfec1c324bd9e7fa121?chain=mainnet) |
| `unwind` | `(ok u99)` | [block 8,879,083](https://explorer.hiro.so/txid/0xfc168e4b2b7b9037742f240ac2624c64ce9ad14ac4959f16fd82996f0640695e?chain=mainnet) |
| `rescue` | `(ok true)` | [block 8,879,085](https://explorer.hiro.so/txid/0xd9dda0d85334e5cac65445927b0bc9e5611db578ba73afe8a5d7b87f7049a074?chain=mainnet) |

`allocate` is the one that matters: the contract deposited real sBTC into Zest's
mainnet vault and received shares. It ended holding zero sBTC and zero shares, and
the whole exercise, deployment included, cost 0.405 STX in fees.

Contract: `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet`, deployed in
[block 8,878,880](https://explorer.hiro.so/txid/0x77489c3697c99efd83ada94c9ebbd681b26d07b21949c842d28386a671a42ebc?chain=mainnet).

## The policy surface

Every constraint is an integer check against on-chain reads. No oracle.

| Constraint | Stops |
|------------|-------|
| Asset allowlist, per owner | Delegate swapping the book into a token it controls |
| Venue allowlist, per owner | Allocation into a protocol the delegate controls |
| Per-move notional cap | One catastrophic reallocation |
| Rate limit over a burn-height window | Churn that burns fees without changing the position |
| Rolling daily notional cap | Slow-drip churn under the per-move cap |
| Minimum-output floor | Moving at a share price worse than the mandate permits |
| Cumulative slippage budget | A delegate grinding the position down through bad fills |
| Expiry | An abandoned delegate allocating forever |

The minimum-output floor is quoted on-chain rather than supplied by the caller. A
delegate that could choose its own slippage floor could defeat the whole design.

The vault also measures every venue call against its own balances rather than
trusting what the venue reports, and refuses the call if they disagree.

The full specification, with the order of every check, the error codes and the
threat model, is in [docs/SPEC.md](docs/SPEC.md).

## Venues

Verified against deployed mainnet contracts using a Clarinet remote-data fork.

| Venue | Accepts a contract | Notes |
|-------|--------------------|-------|
| Zest | yes | Binds `contract-caller`, no `is-standard` guard on recipients |
| Granite | yes | Same pattern; `liquidity-provider-v1` has no `is-standard` at all |
| Bitflow | **no** | `pool-transfer` asserts `(is-standard recipient)` |

Bitflow's pools cannot pay a contract at all. The same guard appears in the xyk
pool, both stableswap pools and the DLMM pools, and in `pool-mint` and
`pool-burn`, so contract-held liquidity provision is closed too. Clarity contracts
are immutable, so this is permanent rather than pending. See
[BITFLOW-REPORT.md](BITFLOW-REPORT.md).

That finding is why this project allocates to lending venues rather than trading
on a DEX.

## Running the tests

You need Node 26 and npm, and network access to `api.hiro.so`: every test forks
Stacks mainnet through Hiro's public API. No API key and no Clarinet CLI are
needed.

    git clone https://github.com/emmanuelist/mandate
    cd mandate
    npm ci
    npx vitest run

The full suite is 73 tests in 17 files and takes about 6 to 8 minutes. It forks
mainnet at block 9,194,000 (`initial_height` in `Clarinet.toml`), so results don't
drift as mainnet moves. Wait for the summary line: output before it is partial.

The Jing test forks an earlier block, 9,036,500, from its own manifest, and runs
on its own:

    npx vitest run --config vitest.jing.config.ts

Hiro rate-limits its public API, so expect lines like `Rate limited, retrying
after 53 seconds...` while the test SDK waits. Now and then a test worker fails to
start (`Failed to start forks worker`), or the SDK panics on a failed request.
That's the network, not the code: wait a minute and run it again. CI does the
same, up to three attempts a minute apart. A warning that the Vitest environment
clarinet "defines the transformMode" comes from Hiro's test environment and is
harmless.

To type-check the contracts with the Clarinet CLI (3.24.1), run `clarinet check`.
If it asks to overwrite the simnet deployment plan, answer Y: that file is
generated and not tracked.

## Deploying to testnet

`deployments/testnet.json` and `deployments/testnet-run.json` record the deployment
and the run above. To check them against the chain, with no keys:

    npm run testnet:verify

To deploy your own copy and run the same lifecycle:

1. Create `settings/Testnet.toml` with one line, `mnemonic = "<your seed words>"`.
   Use a testnet-only seed; the file is gitignored. The seed's first account
   deploys and owns, and its second is the delegate.
2. Run `npm run testnet:accounts` to print both addresses, and send the first at
   least 8.11 testnet STX from a faucet (see
   [testnet faucets](https://docs.stacks.co/learn/network-fundamentals/mainnet-and-testnets)).
3. Run `npm run testnet`. It deploys the five contracts, runs one mandate end to
   end, checks that the books reconcile, and writes your records to
   `deployments/`. Contracts already deployed with the same source are skipped.

## Known limits

- **SIP-010 tokens only.** The vault can't hold native STX, which would need a
  different kind of allowance. sBTC is a SIP-010 token, and so is every asset the
  venues in scope take (D-016).
- **A venue's share ledger is trusted.** The vault checks token balances on the
  token contract, which the venue doesn't control, but shares are the venue's own
  record. A venue that lies consistently about its own ledger can't be caught by
  measuring, so the owner's venue allowlist is the safeguard (D-011).
- **Testnet runs on mocks** (D-004). The vault against Zest's real contract is
  tested on a mainnet fork instead.
- **Jing fills are untested.** Settlement needs a signed Pyth price update, which a
  fork can't produce.

## Layout

    contracts/
      mandate-vault-v3.clar       the vault
      venue-trait.clar            what the vault needs from a venue; Zest's vault fits it as deployed
      sip-010-trait.clar          the standard token trait, carried so one source deploys on every network
      mock-token.clar             stand-in for sBTC on testnet
      mock-venue.clar             stand-in yield venue on testnet
      hostile-venue.clar          a venue that attacks the vault, for the tests
      mandate-vault.clar          first version, kept with its tests
      mandate-vault-v2.clar       second version, kept with its tests
      mandate-probe-mainnet.clar  the minimal probe deployed to mainnet
      *probe.clar, venue-spike.clar   spikes behind the venue findings
    tests/                        73 tests in 17 files, plus the Jing fork
    scripts/                      testnet deploy, run and verify, and the specification check
    deployments/                  testnet records
    docs/                         specification, plan, decisions, evidence and verified facts

## Documentation

| File | What's in it |
|------|--------------|
| [docs/SPEC.md](docs/SPEC.md) | The protocol specification: roles and assets, policy model, authorization flow, error codes, threat model, non-goals |
| [docs/STATE.md](docs/STATE.md) | What works right now, and how each claim was checked |
| [docs/PLAN.md](docs/PLAN.md) | Milestones and their exit criteria |
| [docs/EVIDENCE.md](docs/EVIDENCE.md) | The proof behind every claim here: transactions, CI runs, captured output |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Why things are the way they are |
| [docs/CONTEXT.md](docs/CONTEXT.md) | Verified facts about the contracts and tools Mandate depends on, and their traps |
| [BITFLOW-REPORT.md](BITFLOW-REPORT.md) | Why Bitflow's pools can't pay a contract |
| [MAINNET-RUNBOOK.md](MAINNET-RUNBOOK.md) | How the mainnet probe was deployed and exercised |

## Licence

MIT. See [LICENSE](LICENSE).
