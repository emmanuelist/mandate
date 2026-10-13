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
| E-009 | 2026-10-13 | A contract reaches Zest's `v0-vault-sbtc` through Mandate's own venue trait, which Zest never declares: quote, deposit and redeem on a mainnet fork, with the contract as Zest's account and no adapter in between | `tests/venue-spike.test.ts` (output below) | `1d390ce` |
| E-010 | 2026-10-13 | `mandate-vault-v3` allocates and unwinds through the venue trait with every v2 limit and fix: 23 tests pass against a deterministic venue, and the full suite passes with 54 tests across 15 files | `npx vitest run tests/v3.test.ts`; `npx vitest run` (output below) | `1100249` |
| E-011 | 2026-10-13 | `mandate-vault-v3` works against Zest's real `v0-vault-sbtc` on a mainnet fork, with no adapter: 100,000 sats allocate for 99,937 shares, exactly Zest's quote, with every share held by the vault; unwinding returns 99,999 sats, exactly the quote; the owner's wallet ends 1 sat down from share rounding and the vault ends empty. A zero-slippage mandate allocates; the owner exits with no mandate after revoking and after expiry; every refusal holds with nothing leaving the vault. Full suite: 60 tests across 16 files | `tests/v3-zest-fork.test.ts`; `npx vitest run` (output below) | `f7bc6f0` |
| E-012 | 2026-10-13 | Against a hostile venue every attack is refused with nothing moved: taking more than the move fails at the allowance (`err u0`); reporting more shares than it mints, and paying less than it reports on redeem, fail with `u114` for the delegate and the owner; calling back into the vault mid-call runs as the vault and fails (`u105`); burning more shares than asked fails at the allowance, and another owner's shares are untouched; granting the vault as its own delegate fails (`u115`). With measurement in place, real Zest still gives E-011's numbers. Full suite: 68 tests across 17 files | `tests/v3-hostile.test.ts`, `tests/v3-zest-fork.test.ts`; `npx vitest run` (output below) | `c4cc7b9` |
| E-013 | 2026-10-13 | At the pinned block 9,194,000 with two workers, the full suite passes: 68 tests across 17 files in 454 s locally, with no worker failures. With the default worker count, 3 files failed to start, and each passed alone. CI's earlier failure was the SDK panicking on a 404 "Block not found" while forking the tip | `npx vitest run --maxWorkers=2` (now the config's setting); [CI run 38473841834](https://github.com/emmanuelist/mandate/actions/runs/38473841834) (output below) | `4401a8c` |
| E-014 | 2026-10-13 | `docs/SPEC.md` names all 37 tests in the v3 suites, each beside the attack it shows refused or as a lifecycle test, and a check fails if one goes missing. The parameter edges it states were checked in the simulator: `window-len` 0 lets three allocations through a one-trade window, `max-slip-bps` 10,001 aborts `allocate`, and re-granting resets an exhausted slippage budget | `node scripts/spec-crosscheck.mjs`; a simulator probe (output below) | `2dfc165` |

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

### E-009 output
~~~text
$ npx vitest run tests/venue-spike.test.ts
  fund spike with real sBTC   : (ok true)
  quote via venue trait       : (ok u99937)
  deposit via venue trait     : (ok u99937)
  spike sBTC / Zest shares    : (ok u0) / (ok u99937)
  quote out via venue trait   : (ok u99999)
  redeem via venue trait      : (ok u99999)
  spike sBTC / Zest shares    : (ok u99999) / (ok u0)
      Tests  1 passed (1)
~~~

### E-010 output
~~~text
$ npx vitest run tests/v3.test.ts
  allocate 100k            : (ok u100000) | idle u300000 | position u100000 | vault shares (ok u100000)
  unwind 40k               : (ok u40000) | idle u340000 | position u60000
  owner withdraws 400k     : (ok true) | wallet (ok u1000000)
  2% fill vs 1% limit      : (err u201) | idle u400000
  0.6% then 0.6% vs 1% cum : (ok u9940) (err u112)
  after revoke: agent unwind (err u100) | owner unwind (ok u100000) | withdraw (ok true)
  agentX moving 300k of alice (cap 1k): (err u102)
      Tests  23 passed (23)

$ npx vitest run
 Test Files  15 passed (15)
      Tests  54 passed (54)
~~~

### E-011 output
~~~text
$ npx vitest run tests/v3-zest-fork.test.ts
  deposit 100000 sats      : idle 100000 | vault sBTC 100000
  delegate allocates       : (ok u99937) | quote 99937 | vault holds 99937 Zest shares | delegate holds 0 | vault sBTC 0
  delegate unwinds         : (ok u99999) | quote 99999 | idle 99999 | vault sBTC 99999 | vault Zest shares 0
  owner withdraws          : (ok true) | wallet change -1 sats | left in vault 0
  allocate with 0 bps slippage: (ok u99937)
  after revoke: delegate (err u100) | owner exits (ok u99999) | withdraw (ok true)
  per-move cap : (err u102) | vault sBTC 100000 | vault Zest shares 0
  expired      : (err u103) | vault sBTC 100000 | vault Zest shares 0
  rate window  : (err u110) | vault sBTC 100000 | vault Zest shares 0
  daily cap    : (err u111) | vault sBTC 100000 | vault Zest shares 0
  more than idle: (err u105) | vault sBTC 100000 | vault Zest shares 0
      Tests  6 passed (6)

$ npx vitest run
 Test Files  16 passed (16)
      Tests  60 passed (60)
~~~

### E-012 output
~~~text
$ npx vitest run tests/v3-hostile.test.ts
  takes move + 1           : (err u0) | idle | position | vault tokens | vault shares: u400000 | u0 | (ok u400000) | (ok u0)
  reports 2x the shares    : (err u114) | u400000 | u0 | (ok u400000) | (ok u0)
  re-enters the vault      : (err u105) | u400000 | u0 | (ok u400000) | (ok u0)
  grant to the vault itself: (err u115)
  pays half, reports full  : (err u114) (delegate) (err u114) (owner) | u390000 | u10000 | (ok u390000) | (ok u10000)
  burns asked + 1          : (err u0) | u390000 | u10000 | (ok u780000) | (ok u20000) | bob u10000
      Tests  7 passed (7)

$ npx vitest run tests/v3-zest-fork.test.ts
  delegate allocates       : (ok u99937) | quote 99937 | vault holds 99937 Zest shares | delegate holds 0 | vault sBTC 0
  delegate unwinds         : (ok u99999) | quote 99999 | idle 99999 | vault sBTC 99999 | vault Zest shares 0
      Tests  6 passed (6)

$ npx vitest run
 Test Files  17 passed (17)
      Tests  68 passed (68)
~~~

### E-013 output
~~~text
# CI, forking the tip, run 38473841834:
panicked at components/clarity-repl/src/repl/remote_data/mod.rs:281:32:
called `Result::unwrap()` on an `Err` value: "http error - status: 404 - message: {\"statusCode\":404,\"error\":\"Not Found\",\"message\":\"Block not found\"}"

# local, pinned at 9194000, default worker count:
 Test Files  14 passed (14)
      Tests  64 passed (64)
Error: [vitest-pool]: Failed to start forks worker for test files tests/mainnet-fork.test.ts.
Error: [vitest-pool]: Failed to start forks worker for test files tests/minimum.test.ts.
Error: [vitest-pool]: Failed to start forks worker for test files tests/granite-fork.test.ts.

# the same three, alone: granite-fork 1 passed, minimum 1 passed, mainnet-fork 2 passed

# local, pinned at 9194000, two workers:
$ npx vitest run --maxWorkers=2
 Test Files  17 passed (17)
      Tests  68 passed (68)
~~~

### E-014 output
~~~text
$ node scripts/spec-crosscheck.mjs
docs/SPEC.md names all 37 tests in the v3 suites.

# with one test's name removed from the spec:
docs/SPEC.md is missing 1 of 37 tests:
  tests/v3-hostile.test.ts: reports more shares than it mints: refused

# simulator probe of grant's parameter edges, mock venue:
window-len 0, 1 trade allowed: 1st (ok u1000) 2nd (ok u1000) 3rd (ok u1000)
window-len 144, 1 trade allowed: 1st (ok u1000) 2nd (err u110)
max-slip-bps 10001: threw: Call contract function error: mandate-vault-v3::allocate(...)
cum budget 100, 0.6% fills: 1st (ok u994) 2nd (err u112) | re-grant | next (ok u994)
~~~
