# Bitflow's pools pay contracts on mainnet

**Correction, 2026-10-20.** An earlier version of this report said that Bitflow's pools
reject contract principals as swap recipients. That was wrong. The guard it described
is a network check, and the test behind it ran on a mainnet fork that deploys contracts
from a testnet-format address. This version replaces it (D-026, E-040, #58).

## The guard

Bitflow's pools assert, before paying out:

    ;; xyk-pool-sbtc-stx-v-1-1, pool-transfer, line 242
    (asserts! (is-standard recipient) ERR_INVALID_PRINCIPAL)  ;; u3003

`is-standard` tests whether a principal belongs to the current network. It is true for
any `SP` or `SM` principal on mainnet, contracts included. Clarity's function reference
gives the example `(is-standard 'SP3X6QWWETNBZWGBK6DRGTR1KX50S74D3433WDGJY.foo)`, which
returns true on mainnet. A contract deployed on mainnet therefore passes the check, so it
can receive a swap's output. `pool-mint` and `pool-burn` apply the same check to the
liquidity provider, so the same reasoning applies to liquidity provision, which has not
been tested here.

The same guard appears in the xyk, stableswap and DLMM pools, including the DLMM pools
deployed between August and October 2026 (`pool-transfer` at line 534 in each).

## Why it looked like a refusal

Clarinet's simulator deploys a project's contracts from
`ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM`, a testnet-format address, even when
`[repl.remote_data]` forks mainnet. On a mainnet fork, `is-standard` is false for those
contracts, so the pool refuses them with `u3003`. The earlier report read that refusal
as Bitflow refusing contracts.

## What mainnet and the fork show

On mainnet, `dlmm-pool-sbtc-usdcx-v-2-bps-10` has paid USDCx to contracts in successful
transactions, among them a keeper contract built on Bitflow's own keeper product:

| Block | Paid to | Transaction |
| --- | --- | --- |
| 8,816,074 | `SP3R9DNHRSBPT42JX98J92ZJHASWSBXT5ZW8X4XCK.keeper-5-lwdf9jx3h-v-1-1` | `0xc8638b84eb6b68366574cd890ef8bcae66d16a90567d5992f0b46f4aa9c615f1` |
| 8,816,082 | the same keeper contract | `0x3e0f1d713ecd2c5afedbdc1fed0be5e51bd36abb221347187a37f0073f75e297` |
| 8,816,527 | `SP3EWCDA3V8HCP64CSETSNYXZ25WC4AJ95EC0ZEST.dlmm-adapter` | `0x8b95951fe3b2c820b12824b285c60985ef208ce4eec8482d37d1481e1cc710da` |
| 8,822,190 | `SP2H674PRTZV6YW56K0FMR7GDGZE4ZC5HMYZ3CDEV.nana` | `0x9913f5f29709cb28a22733627da6dd074ccf986a25b47a869e6f3d3e120b8409` |

On a mainnet fork, `tests/bitflow-fork.test.ts` deploys the same probe contract twice and
swaps 100,000 sats of its own sBTC for STX through `xyk-core-v-1-2`:

| Deployed from | `is-standard` on the probe | Swap |
| --- | --- | --- |
| `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM`, the simulator's address | false | `(err u3003)`, nothing paid |
| `SP1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRCBGD7R`, the same key's mainnet form | true | `(ok u192131720)`: 192.13 STX paid to the probe |

## What this means for Mandate

Bitflow is open to contracts, including vaults and agents that hold their own balances.
Mandate's vault still allocates only to lending venues for now (D-026). A swap converts
one asset into another, which brings price risk that the policy model does not yet
bound, and adding swaps would need a new version of the vault. To test a mainnet
contract's behaviour on a fork, deploy it from a mainnet-format address
(`docs/CONTEXT.md`).
