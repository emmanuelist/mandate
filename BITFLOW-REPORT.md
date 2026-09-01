# Bitflow pools reject contract principals as swap recipients

Sharing a composability limitation found while building a non-custodial vault on Stacks.
Not a security issue — no funds are at risk. It does mean contracts cannot integrate the
pools, which may not be intended.

## What happens

`pool-transfer` asserts the recipient is a standard principal:

    ;; xyk-pool-sbtc-stx-v-1-1, pool-transfer
    (asserts! (is-standard recipient) ERR_INVALID_PRINCIPAL)  ;; u3003

`xyk-core-v-1-2.swap-x-for-y` calls `pool-transfer ... caller`, where `caller` is
`tx-sender`. A contract swapping its own balance uses `as-contract`, which makes
`tx-sender` the contract — so `is-standard` is false and the swap reverts with `u3003`.

The contract can pay *into* a swap but can never receive the output.

## Reproduction

Clarinet 3.21 with `[repl.remote_data]` forking mainnet. A minimal vault holding real
sBTC calls `swap-x-for-y` through `as-contract` against `xyk-pool-sbtc-stx-v-1-1`:

    deposit real sBTC : (ok true)
    swap via contract : (err u3003)   ;; ERR_INVALID_PRINCIPAL

## Scope

Same guard present in:

- `xyk-pool-sbtc-stx-v-1-1` — `pool-transfer`
- `stableswap-pool-sbtc-pbtc-v-1-1` — `pool-transfer`
- `stableswap-pool-aeusdc-usdh-v-1-2` — `pool-transfer`

`pool-mint` and `pool-burn` carry it too, so LP tokens cannot be minted to a contract:
contract-held liquidity provision is also closed.

`xyk-core-v-1-2` itself has no such guard — its only `is-standard` assertions are in
`set-fee-address` and `create-pool`, on the fee address and token contracts. Reading the
core alone suggests contracts are supported; the restriction is one contract deeper.

## Why it matters

Vaults, aggregators, treasury contracts, and autonomous agents holding their own balances
cannot route through Bitflow pools. For comparison, Zest `v0-vault-sbtc` and Granite
`liquidity-provider-v1` both bind `contract-caller` as the account and place no
`is-standard` guard on recipients, so contracts are first-class there.

If the guard is deliberate, it would help integrators to have it documented. If it is
inherited boilerplate, relaxing it on the recipient in a future pool version would open
Bitflow to contract-based integrations.

Happy to share the test harness.
