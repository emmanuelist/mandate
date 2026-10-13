# Mandate

A non-custodial Clarity vault that lets an owner put someone else in charge of
their sBTC — a manager, a desk, or an autonomous agent — inside limits the chain
enforces.

The delegate can move funds between allowlisted yield venues and nothing else. It
can never withdraw. The owner can revoke in any block, and withdrawal pays the
owner and nobody else.

This is the instrument asset management already runs on, expressed in Clarity and
enforced by the chain rather than by contract law.

## Why

Stacks has the places to put Bitcoin — Zest and Granite hold most of the
ecosystem's lending capital, and PoX-5 now pays staking rewards in sBTC. It has no
way to put someone *else* in charge of capital sitting in them. Delegation means
handing over keys, so in practice nobody delegates and every managed strategy runs
on its manager's own balance sheet.

## Status

Proven on mainnet with a deliberately minimal probe contract rather than the full
vault:

| Call | Result | Transaction |
|------|--------|-------------|
| `fund` | `(ok true)` | `0x8251abef4b4c76dc588c54722098f0fdc8860157602cf501e0815f2036b03df6` |
| `allocate` | `(ok u99)` | `0x8fa8b392a30e7786860e187a7c0cf62e5aa812150dbb0bfec1c324bd9e7fa121` |
| `unwind` | `(ok u99)` | `0xfc168e4b2b7b9037742f240ac2624c64ce9ad14ac4959f16fd82996f0640695e` |
| `rescue` | `(ok true)` | `0xd9dda0d85334e5cac65445927b0bc9e5611db578ba73afe8a5d7b87f7049a074` |

`allocate` is the one that matters: a Clarity contract deposited real sBTC into
Zest's mainnet vault and received shares. The contract ended holding zero sBTC and
zero shares. Whole exercise cost 0.405 STX.

Contract: `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet`

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

## Venues

Verified against deployed mainnet contracts using a Clarinet remote-data fork.

| Venue | Accepts a contract | Notes |
|-------|--------------------|-------|
| Zest | yes | Binds `contract-caller`, no `is-standard` guard on recipients |
| Granite | yes | Same pattern; `liquidity-provider-v1` has no `is-standard` at all |
| Bitflow | **no** | `pool-transfer` asserts `(is-standard recipient)` |

Bitflow's pools cannot pay a contract at all. The same guard appears in the xyk
pool, both stableswap pools and the DLMM pools, and in `pool-mint` and
`pool-burn`, so contract-held liquidity provision is closed too. Clarity contracts are immutable, so this is
permanent rather than pending. See [BITFLOW-REPORT.md](BITFLOW-REPORT.md).

That finding is why this project allocates to lending venues rather than trading
on a DEX.

## Layout

    contracts/
      mandate-vault.clar          first version, retained for the adversarial tests
      mandate-vault-v2.clar       current vault
      mandate-probe-mainnet.clar  minimal owner-only probe, deployed to mainnet
      zest-probe.clar             Zest deposit and redeem
      granite-probe.clar          Granite collateral
      multi-asset-probe.clar      one adapter across every Zest vault
      mock-token.clar             SIP-010 used to exercise the ledger in tests
      c4probe.clar                Clarity 4 as-contract? allowance syntax
    tests/                        30 tests across 13 files

## Running it

    clarinet check
    npm install && npm test

Fork tests read live mainnet state through `[repl.remote_data]`, so they take
tens of seconds and need network. A transient failure usually means a rate limit,
not a regression — rerun before believing it.

## Licence

MIT.
