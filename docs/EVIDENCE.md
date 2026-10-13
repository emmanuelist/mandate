# Evidence
Append-only proof log. Every claim in the README, the specification or a milestone report points to an entry here. Proof is a public link, or a command with its captured output.

| # | Date | Claim | Proof | Commit |
|---|---|---|---|---|
| E-001 | 2026-08-30 | `mandate-probe-mainnet` is deployed on Stacks mainnet, and its on-chain source is byte-identical to `contracts/mandate-probe-mainnet.clar` | [deploy transaction](https://explorer.hiro.so/txid/0x77489c3697c99efd83ada94c9ebbd681b26d07b21949c842d28386a671a42ebc?chain=mainnet), block 8,878,880; source compared 2026-10-13 (output below) | `8ef0de5` |
| E-002 | 2026-08-30 | A Clarity contract deposited real sBTC into Zest and redeemed it on mainnet, and the owner took it back out | [fund](https://explorer.hiro.so/txid/0x8251abef4b4c76dc588c54722098f0fdc8860157602cf501e0815f2036b03df6?chain=mainnet) `(ok true)` · [allocate](https://explorer.hiro.so/txid/0x8fa8b392a30e7786860e187a7c0cf62e5aa812150dbb0bfec1c324bd9e7fa121?chain=mainnet) `(ok u99)` · [unwind](https://explorer.hiro.so/txid/0xfc168e4b2b7b9037742f240ac2624c64ce9ad14ac4959f16fd82996f0640695e?chain=mainnet) `(ok u99)` · [rescue](https://explorer.hiro.so/txid/0xd9dda0d85334e5cac65445927b0bc9e5611db578ba73afe8a5d7b87f7049a074?chain=mainnet) `(ok true)`; re-read from the API 2026-10-13 | `8ef0de5` |
| E-003 | 2026-10-13 | Bitflow's pools refuse a contract as recipient: `pool-transfer` asserts `is-standard` on the recipient in the xyk pool, both stableswap pools and two DLMM pools, and on a mainnet fork the vault's swap fails with `(err u3003)` | deployed source of all five pools; `tests/e2e-fork.test.ts` (output below) | `9819746` |
| E-004 | 2026-10-13 | Zest accepts a contract as depositor: on a mainnet fork a contract deposits real sBTC, redeems it, and a stranger can neither allocate nor drain it | `tests/zest-fork.test.ts`, `tests/mainnet-probe.test.ts` (output in E-007) | `9819746` |
| E-005 | 2026-10-13 | Granite accepts real sBTC posted as collateral by a contract, on a mainnet fork | `tests/granite-fork.test.ts`: `(ok true)` (output in E-007) | `9819746` |
| E-006 | 2026-10-13 | Jing's `markets-sbtc-stx-jing-v6-2` accepts a contract as maker on a fork pinned at block 9,036,500: the deposit is recorded under the contract and a cancel refunds it in full. Fills are not tested; settlement needs a signed Pyth update | `npx vitest run --config vitest.jing.config.ts` (output below) | `9819746` |
| E-007 | 2026-10-13 | The full suite passes: 30 tests across 13 files on a mainnet fork, including the fixes for the five defects an adversarial pass found in the first vault | `npx vitest run` (output below) | `9819746` |
| E-008 | 2026-10-13 | CI passes on GitHub's runners: the identity check passes on the pull request's 5 commits, and on a mainnet fork the full suite (30 tests, 13 files) and the Jing suite (1 test) pass. Hiro rate-limited the run 11 times and the SDK's retries absorbed it | [CI run](https://github.com/emmanuelist/mandate/actions/runs/38457131065): commit identity 7 s; tests 4 m 41 s (full suite 249 s, Jing 15 s) | `c519429` |

### E-001 output
~~~text
$ curl -s "https://api.hiro.so/v2/contracts/source/SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH/mandate-probe-mainnet?proof=0" \
    | python3 -c "import sys,json;sys.stdout.write(json.load(sys.stdin)['source'])" > onchain.clar
$ diff -q onchain.clar contracts/mandate-probe-mainnet.clar && echo byte-identical
byte-identical
~~~

### E-002 output
Each transaction re-read from `https://api.hiro.so/extended/v1/tx/<txid>` on 2026-10-13:
~~~text
smart_contract  success  block 8878880  (ok true)
fund            success  block 8879077  (ok true)
allocate        success  block 8879080  (ok u99)
unwind          success  block 8879083  (ok u99)
rescue          success  block 8879085  (ok true)
~~~

### E-003 output
Deployed source from `https://api.hiro.so/v2/contracts/source/...`, 2026-10-13. xyk and stableswap pools are under `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR`, DLMM pools under `SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD`.
~~~text
pool                                 pool-transfer   (asserts! (is-standard recipient) ...)
xyk-pool-sbtc-stx-v-1-1              line 231        line 242
stableswap-pool-sbtc-pbtc-v-1-1      line 285        line 296
stableswap-pool-aeusdc-usdh-v-1-2    line 285        line 296
dlmm-pool-stx-sbtc-v-3-bps-15        line 520        line 534
dlmm-pool-sbtc-usdcx-v-2-bps-10      line 520        line 534

tests/e2e-fork.test.ts > REGRESSION: Bitflow pools refuse a contract recipient
  deposit real sBTC   : (ok true)
  agent executes swap : (err u3003)
~~~

### E-006 output
~~~text
$ npx vitest run --config vitest.jing.config.ts
  fund probe with real sBTC   : (ok true)
  probe sBTC before           : (ok u10000)
  contract posts maker order  : (ok u10000)
  market records deposit      : u10000
  depositors list             : (list 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.jing-probe)
  probe sBTC after make       : (ok u0)
  contract cancels            : (ok u10000)
  probe sBTC after cancel     : (ok u10000)
 Test Files  1 passed (1)
      Tests  1 passed (1)
~~~

### E-007 output
~~~text
$ npx vitest run
 Test Files  13 passed (13)
      Tests  30 passed (30)
   Duration  117.17s
~~~
The five defects, the fix in `contracts/mandate-vault-v2.clar`, and the passing test that holds each fix. `tests/attack.test.ts` reproduces the first three against the first vault, `contracts/mandate-vault.clar`.

| Defect in the first vault | Fix | Test |
|---|---|---|
| Revoking a mandate stranded the owner's funds | withdrawal depends on the ledger, not on a live mandate | `v2.test.ts` "FIX: revoking no longer strands funds" |
| A stranger could hijack another owner's delegate | mandates keyed by owner and delegate together | `v2.test.ts` "FIX: a stranger cannot redirect another owner's agent" |
| The delegate chose its own minimum output | minimum output quoted on-chain | `v2.test.ts` "FIX: the agent can no longer choose its own slippage floor" |
| Custody was commingled | a ledger per owner and per token | `policy.test.ts` "one owner cannot withdraw another owner's deposit" |
| Allowlists were global, and anyone could write them | allowlists per owner | `allowlist-attack.test.ts` "mallory allowlisting a venue does not affect alice" |

Selected results from the same run:
~~~text
  contract deposits to Zest : (ok u99937)
  contract redeems from Zest: (ok u99999)
  stranger allocate       : (err u401)
  stranger rescue         : (err u401)
  contract posts collateral   : (ok true)
  agentX spending 50M of alice (cap 1M): (err u102)
  bob withdrawing alice's 400k: (err u105)
  execute with no allowlist entry: (err u106)
  execute 1000 against a 500 daily cap: (err u111)
~~~
