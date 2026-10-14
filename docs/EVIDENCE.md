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
| E-014 | 2026-10-13 | `docs/SPEC.md` names all 37 tests in the v3 suites, each beside the attack it shows refused or as a lifecycle test, and a check fails if one goes missing. The parameter edges it states were checked in the simulator: `window-len` 0 lets three allocations through a one-trade window, `max-slip-bps` 10,001 aborts `allocate`, and re-granting resets an exhausted slippage budget | `node scripts/spec-crosscheck.mjs`; a simulator probe (output below) | `9e58f5d` |
| E-015 | 2026-10-13 | CI without the fork-data cache and with up to three attempts per fork suite passes on its first attempt: 68 tests across 17 files and the Jing suite's 1, with 13 rate-limit waits, no worker failures and no panics | [CI run 38481444141](https://github.com/emmanuelist/mandate/actions/runs/38481444141) (#19) | `1957a28` |
| E-016 | 2026-10-14 | `grant` refuses a zero-length rate window, per-move slippage above 100% and a slippage budget above 100% (`u116`), accepts the boundaries, and a refused grant leaves the existing mandate in force. The spec check caught the five new tests before the spec named them. Full suite: 73 tests across 17 files | `tests/v3.test.ts`; `node scripts/spec-crosscheck.mjs`; `npx vitest run` | `afbdf1e` |
| E-017 | 2026-10-14 | The M1 contracts are deployed on Stacks testnet under `ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5`, each with the repo's source and Clarity version: `mandate-vault-v3`, a mock sBTC (`mock-token`), a mock venue (`mock-venue`) and the two traits the vault uses | deploy transactions: [mandate-vault-v3](https://explorer.hiro.so/txid/0x26400b07e407980984c89c9da2cf61ff469202e4c14eb97af4241e3a91700ce6?chain=testnet) · [mock-token](https://explorer.hiro.so/txid/0xa9ff4fbe791268326039434dfa0222333bf3a8717efcef0ab76db5dd463c2a6e?chain=testnet) · [mock-venue](https://explorer.hiro.so/txid/0xc9de22d0954b5f53fa05c5ca1ea8451b258bd4790aad4e8929b32200ef0f6439?chain=testnet) · [sip-010-trait](https://explorer.hiro.so/txid/0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee?chain=testnet) · [venue-trait](https://explorer.hiro.so/txid/0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b?chain=testnet), blocks 719,259 to 719,267; `npm run testnet:verify` (output below) | `f00508b` |
| E-018 | 2026-10-14 | One mandate end to end on testnet, one transaction per step: the owner deposits 400,000 mock sBTC and grants a delegate, the delegate allocates 100,000 into the mock venue and unwinds it, and the owner withdraws all 400,000. Afterwards the owner's vault balance and position and the vault's tokens are zero, and the owner's wallet holds all 1,000,000 minted | [deposit](https://explorer.hiro.so/txid/0xcc2bd1d810ff14b4e062d73d28ea797ed2b6582c7cf3dfaa287fa66f5aa60e99?chain=testnet) `(ok true)` · [grant](https://explorer.hiro.so/txid/0x37d9f9c90177209edecb94bc08fc62a2b0436f2d0d97a223b24eb23ffc80d5ad?chain=testnet) `(ok true)` · [allocate](https://explorer.hiro.so/txid/0x5ec913434edac52e3931ffeff81d1dac5ce7d85d60deb35380dcbb223ffa7363?chain=testnet) `(ok u100000)` · [unwind](https://explorer.hiro.so/txid/0xeb6f3bb4678fd50f4616e14d15cf49391b86fd18499c38a2fdd97cd615930b68?chain=testnet) `(ok u100000)` · [withdraw](https://explorer.hiro.so/txid/0xfe071e940bcd51510c8cf451b99ec2a46b8e9752cdcba546076843a1e14c1974?chain=testnet) `(ok true)`; blocks 719,271 to 719,287. All nine steps, with the reads after, are in `deployments/testnet-run.json` at `7f65fef`, re-read from the chain in E-017's output | `7f65fef` |
| E-019 | 2026-10-14 | Rebuilding is one command. On the deployed contracts, `npm run testnet` finds all five identical to the repo and sends no deploys, then repeats the lifecycle, and the books reconcile against reads taken before the run; the script fails if they don't. With a contract edited locally, the deploy step stops before sending anything and `npm run testnet:verify` fails. A fresh run costs account 1 8.11 STX: 2.5 in deploy fees, 0.61 in call fees, and 5 sent to the delegate | [deposit](https://explorer.hiro.so/txid/0x1b7330937d2c0d4dfec50d2023302223b9e6fc6b86dbb345ffbab22bf7852d0f?chain=testnet) `(ok true)` · [grant](https://explorer.hiro.so/txid/0xfb677877d675498fe0dfccd0f95f654aa576c9c81bb34b64eece2f315ae8c673?chain=testnet) `(ok true)` · [allocate](https://explorer.hiro.so/txid/0x73924838982ced49643ec0e3710b712b624fb140ed7e5e33e734a9eeb431e03f?chain=testnet) `(ok u100000)` · [unwind](https://explorer.hiro.so/txid/0x43bad4af1df7ee5f48df87a9cf9b7a8f89a2981ef99f97b53248d1c5e536f2ab?chain=testnet) `(ok u100000)` · [withdraw](https://explorer.hiro.so/txid/0x1f978cfe8c63bd739e09495ca52f93b412bed98d60998ace774fa2e795cf7af5?chain=testnet) `(ok true)`; blocks 719,366 to 719,385; output below | `0706d6d` |
| E-020 | 2026-10-14 | Back-to-back retries fail together inside a rate-limit window. On `main` after #21, the Jing suite's worker failed to start three times between 00:40:03.8 and 00:40:06.4 UTC, three seconds after Hiro had told the runner to wait 29 and 53 s. The pull request's run of the same code started the suite after its last wait had run out, and passed. Rerun, the failed job passed: the Jing suite started inside a window again, and this time the SDK waited out its one rate limit. The new loop waits 60 s between attempts and still exits at once on a pass | [run 38491027038](https://github.com/emmanuelist/mandate/actions/runs/38491027038), attempts 1 and 2; [run 38490379351](https://github.com/emmanuelist/mandate/actions/runs/38490379351); the loop run locally (output below) | `fb2d0d4`, `e60ffca` |
| E-021 | 2026-10-14 | The minute's wait worked the first time CI needed it. On #23, Hiro told the runner to wait 51 and 53 s at 00:55:02 and 00:55:03 UTC; ten of the full suite's workers failed to start at 00:55:12, and the attempt failed. The retry began at 00:56:13, after that window had closed, and passed 73 of 73; the Jing suite then passed. Back to back, the retry would have started inside the window | [run 38492547121](https://github.com/emmanuelist/mandate/actions/runs/38492547121) (output below) | `cb54a4d` |
| E-022 | 2026-10-14 | The README works for a stranger. From a fresh clone of `9-readme`, with only Node 26, npm and npx on PATH and no Clarinet CLI, `npm ci`, the full suite (73 of 73 in 17 files), the Jing suite (1 of 1) and `npm run testnet:verify` (14 of 14 checks) pass, and the clone stays clean. Without `settings/Testnet.toml`, the testnet scripts say how to create it. The README's other claims, checked the same day: the mainnet probe's five transactions cost 405,381 µSTX in fees and left it holding no STX, sBTC or Zest shares; Zest and Granite hold 98% of Stacks lending and CDP TVL on DeFiLlama; PoX-5 accrues staking rewards as sBTC; `clarinet check` checks 14 contracts after its overwrite prompt | transcript below; [DeFiLlama protocols API](https://api.llama.fi/protocols); [What's Changed in PoX-5](https://docs.stacks.co/operate/staking-stx/whats-changed-in-pox-5) | `efcb173`, `b97080f` |
| E-023 | 2026-10-14 | The vault and a testnet sBTC venue work with testnet's official sBTC on a testnet fork pinned at block 719,800: a real holder deposits 100,000 sats, the delegate allocates and unwinds them, and the owner withdraws, with every sat accounted for. A 2% fill against a 1% limit is refused by the venue enforcing the vault's floor (`u201`), and nothing moves. The Clarinet SDK forks testnet through `api_url` | `npx vitest run --config vitest.testnet.config.ts` (output below) | `8a0276a` |
| E-024 | 2026-10-14 | M1's lifecycle on testnet with testnet's official sBTC, one transaction per step: the owner deposits 20,000 sats and grants a delegate, the delegate allocates 10,000 into the testnet sBTC venue and unwinds them, and the owner withdraws all 20,000. The transfer events show the sBTC moving from owner to vault, vault to venue, venue to vault and vault to owner, and the books end where they started. `npm run testnet` deployed only the new venue, finding the other three contracts identical to the repo | [deposit](https://explorer.hiro.so/txid/0xd210c8dd03fa8051bbd01d00082f883b76c5997c6b64d24f75a46b210bb75de5?chain=testnet) `(ok true)` · [grant](https://explorer.hiro.so/txid/0x085c254f86569275e8bfa0cac65152a84875dde97ea676d55cc801159a25fbf9?chain=testnet) `(ok true)` · [allocate](https://explorer.hiro.so/txid/0x1f5c17e483098fdbd11fe14f7f083b50d02febc1c5efdb81ba9e0faad63edbf4?chain=testnet) `(ok u10000)` · [unwind](https://explorer.hiro.so/txid/0xa7be818fc0711f31c6f372f1e7755e3506d8dcd0c4122f84b1c330d57fd815b6?chain=testnet) `(ok u10000)` · [withdraw](https://explorer.hiro.so/txid/0xbf277b197ad41ffc5816129ebc3c2463f7954d6baeba25b3b89d3599333f061a?chain=testnet) `(ok true)`; blocks 719,935 to 719,947; venue deployed in [block 719,933](https://explorer.hiro.so/txid/0x086d9b94b07098b68399dfabc75e5716329b8f81b7a8bbb5ef8e0de4a65497c4?chain=testnet); `npm run testnet:verify` (output below) | `655e5df` |
| E-025 | 2026-10-14 | `npm audit` finds no vulnerabilities after a lockfile-only update of `source-map-js`, which vitest pulls in through vite and postcss, from 1.2.1 to 1.2.2, the first version GHSA-68fv-2mgg-jv7q lists as patched. The hostile-venue suite passes on the patched lockfile, and CI runs all three fork suites on it | `npm audit` and the advisory (output below); the pull request's CI run | `7655365` |
| E-026 | 2026-10-14 | v4 enforces the per-vault AUM cap. Deposits up to the cap succeed across owners, and one sat over is refused with nothing moved (`u117`). A withdrawal frees room under it, and moving funds into a venue does not. An asset without a cap can't be deposited. Only the deployer sets a cap, once, never zero, and it can't be raised (`u118`, `u116`, `u119`). The 42 tests moved from v3 pass against v4 with caps set, and the full suite passes: 77 tests in 17 files | `npx vitest run tests/v4.test.ts` and `npx vitest run` (output below) | `0e29ba6` |
| E-027 | 2026-10-14 | A contract an owner calls could act as the owner against v3, and can't against v4. Against v3, one call to a contract posing as an airdrop moved the owner's 400,000 idle tokens into the attacker's venue, which never pays them back. Against v4 the same call is refused (`u100`) with nothing moved, and a contract owner acting for itself from inside `as-contract?` still deposits and withdraws. The v4 suites pass with the change, 49 tests, and the hostile venue's callback is still refused (`u105`). The full suite passes: 80 tests in 18 files | `npx vitest run tests/phishing.test.ts` (output below) | `aa27bdf` |

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

### E-017 output
~~~text
# 2026-10-14, the first run's records (7f65fef), checked with no keys:
$ npm run testnet:verify
contracts deployed by ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5:
  ok   sip-010-trait     block 719259, Clarity 4, source identical to the repo
  ok   venue-trait       block 719260, Clarity 4, source identical to the repo
  ok   mock-token        block 719263, Clarity 3, source identical to the repo
  ok   mock-venue        block 719265, Clarity 4, source identical to the repo
  ok   mandate-vault-v3  block 719267, Clarity 4, source identical to the repo
end-to-end run, owner ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5, delegate ST3TMSRWZJ2F50307Q1A5B6KXY4YZ6CTW66D2BWFW:
  ok   fund the delegate's fees: 5 STX  success, block 719271, (ok true)
  ok   owner mints 1,000,000 mock       success, block 719273, (ok true)
  ok   owner allowlists the asset       success, block 719275, (ok true)
  ok   owner allowlists the venue       success, block 719277, (ok true)
  ok   owner deposits 400,000           success, block 719279, (ok true)
  ok   owner grants the delegate        success, block 719281, (ok true)
  ok   delegate allocates 100,000       success, block 719283, (ok u100000)
  ok   delegate unwinds 100,000         success, block 719285, (ok u100000)
  ok   owner withdraws 400,000          success, block 719287, (ok true)
all 14 checks pass

# the reads after that run (deployments/testnet-run.json at 7f65fef):
{"ownerIdleInVault":"u0","ownerPosition":"u0","ownerWallet":"(ok u1000000)","vaultTokens":"(ok u0)"}
~~~

### E-019 output
~~~text
$ npm run testnet
deployer ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5
  sip-010-trait     already deployed, identical to the repo   0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee
  venue-trait       already deployed, identical to the repo   0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b
  mock-token        already deployed, identical to the repo   0xa9ff4fbe791268326039434dfa0222333bf3a8717efcef0ab76db5dd463c2a6e
  mock-venue        already deployed, identical to the repo   0xc9de22d0954b5f53fa05c5ca1ea8451b258bd4790aad4e8929b32200ef0f6439
  mandate-vault-v3  already deployed, identical to the repo   0x26400b07e407980984c89c9da2cf61ff469202e4c14eb97af4241e3a91700ce6
wrote deployments/testnet.json
owner ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5
delegate ST3TMSRWZJ2F50307Q1A5B6KXY4YZ6CTW66D2BWFW
  fund the delegate's fees: 5 STX 0xa7ecf03b68699b398858608ad01a8c6e749e61b1f9900b1d36a0b192ca90e08b ... (ok true), block 719366
  owner mints 1,000,000 mock     0xabcc7e0d465a98c0294ad3f0b8d2cb2ea2cd461f8d1df682ffa0d26d7e73adf9 ... (ok true), block 719369
  owner allowlists the asset     0xbdd7d800fb5fd0a32156fca8bfc5d96c2ae10899e426804997520fa32f54be65 ... (ok true), block 719371
  owner allowlists the venue     0xcd8e8dccd412434d0b3e3e681bdc4d30d06d9043dea41c6fa58dd5bcd321c296 ... (ok true), block 719373
  owner deposits 400,000         0x1b7330937d2c0d4dfec50d2023302223b9e6fc6b86dbb345ffbab22bf7852d0f ... (ok true), block 719376
  owner grants the delegate      0xfb677877d675498fe0dfccd0f95f654aa576c9c81bb34b64eece2f315ae8c673 ... (ok true), block 719378
  delegate allocates 100,000     0x73924838982ced49643ec0e3710b712b624fb140ed7e5e33e734a9eeb431e03f ... (ok u100000), block 719382
  delegate unwinds 100,000       0x43bad4af1df7ee5f48df87a9cf9b7a8f89a2981ef99f97b53248d1c5e536f2ab ... (ok u100000), block 719384
  owner withdraws 400,000        0x1f978cfe8c63bd739e09495ca52f93b412bed98d60998ace774fa2e795cf7af5 ... (ok true), block 719385
books reconcile, before: {"ownerIdleInVault":"u0","ownerPosition":"u0","ownerWallet":"(ok u1000000)","vaultTokens":"(ok u0)"} 
                  after:  {"ownerIdleInVault":"u0","ownerPosition":"u0","ownerWallet":"(ok u2000000)","vaultTokens":"(ok u0)"}
wrote deployments/testnet-run.json
exit 0 · elapsed 124 s

# the rerun's records then pass `npm run testnet:verify`: all 14 checks pass.
# account 1: 500 STX before the first run, 486.28 after both runs (8.11 + 5.61).

# with contracts/mock-venue.clar edited locally:
$ npm run testnet:verify
  FAIL mock-venue        block 719265, Clarity 4, source DIFFERS from the repo
1 of 14 checks failed
(exit code 1)
$ node scripts/testnet-deploy.mjs
  sip-010-trait     already deployed, identical to the repo   0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee
  venue-trait       already deployed, identical to the repo   0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b
  mock-token        already deployed, identical to the repo   0xa9ff4fbe791268326039434dfa0222333bf3a8717efcef0ab76db5dd463c2a6e
Error: ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5.mock-venue was deployed from a different contracts/mock-venue.clar: deploy from a fresh testnet account
~~~

### E-020 output
~~~text
# run 38491027038, attempt 1: main at fb2d0d4 (UTC)
00:40:00.2  full suite  Rate limited, retrying after 53 seconds...
00:40:00.9  full suite  Rate limited, retrying after 29 seconds...
00:40:03.8  full suite  Tests  73 passed (73)
00:40:04.7  Jing suite  Error: [vitest-pool]: Failed to start forks worker for test files /home/runner/work/mandate/mandate/tests/jing-fork.fork.ts.
00:40:04.7  Jing suite  attempt 1 failed
00:40:05.6  Jing suite  attempt 2 failed, the same error
00:40:06.4  Jing suite  attempt 3 failed, the same error
waits Hiro asked for in this attempt (s): 1 1 25 26 29 53 55 56 56 56 57 57

# run 38490379351: the pull request, the same code
00:33:06.1  full suite  Rate limited, retrying after 54 seconds...   (its last)
00:34:09.7  full suite  Tests  73 passed (73)
00:34:18.0  Jing suite  Tests  1 passed (1)

# run 38491027038, attempt 2: the failed job rerun
00:49:02.6  full suite  Rate limited, retrying after 54 seconds...
00:49:17.4  full suite  Tests  73 passed (73)
00:49:20.3  Jing suite  Rate limited, retrying after 40 seconds...
00:50:13.5  Jing suite  Tests  1 passed (1)

# the new retry loop at e60ffca, run locally under bash -e with stand-ins for npx and sleep:
passes on attempt 1: exit 0, 1 attempt, no wait
passes on attempt 2: exit 0, 2 attempts, one 60 s wait
never passes:        exit 1, 3 attempts, two 60 s waits
~~~

### E-021 output
~~~text
# run 38492547121: #23 (UTC)
00:52:08.1  full suite  attempt 1 starts
00:55:01.8  full suite  Rate limited, retrying after 51 seconds...
00:55:03.2  full suite  Rate limited, retrying after 53 seconds...
00:55:12.4  full suite  Error: [vitest-pool]: Failed to start forks worker, for 10 test files at once
00:55:12.4  full suite  Test Files  7 passed (7), Tests  9 passed (9)
00:55:12.5  full suite  attempt 1 failed
00:56:13.0  full suite  attempt 2 starts, after the 60 s wait
01:02:06.5  full suite  Tests  73 passed (73)
01:03:06.3  Jing suite  Tests  1 passed (1)
no panics in the run
~~~

### E-022 output
~~~text
# a fresh clone of 9-readme from GitHub, 2026-10-14T01:20:14Z
# PATH holds node, npm, npx and /usr/bin:/bin only
node v26.7.0 · npm 11.19.0 · clarinet: not on PATH
cloned at efcb173

$ npm ci
exit 0 in 2 s   (npm warns that it skipped fsevents' install script)

$ npx vitest run
 Test Files  17 passed (17)
      Tests  73 passed (73)
rate-limit waits: 4 · transformMode warnings: 17
exit 0 in 419 s

$ npx vitest run --config vitest.jing.config.ts
 Test Files  1 passed (1)
      Tests  1 passed (1)
exit 0 in 59 s

$ npm run testnet:verify
all 14 checks pass
exit 0

$ npm run testnet:accounts
Error: No settings/Testnet.toml: create it with one line, mnemonic = "<a testnet-only seed>" (see the README)
exit 1

$ git status --short
(clean)

# b97080f, the formal edit of the README, changes no command: the command lists of the two versions are identical.

# the README's other claims, checked 2026-10-14
mainnet probe fees (µSTX): deploy 393,381 + fund 3,000 + allocate 3,000 + unwind 3,000 + rescue 3,000 = 405,381
mainnet probe balances: STX 0; sbtc-token received 199, sent 199, balance 0; v0-vault-sbtc::zft received 99, sent 99, balance 0; 5 transactions in total
DeFiLlama, Stacks lending and CDP TVL $89.0M: Zest V2 87.1%, Granite 7.9%, Zest V1 3.1%, Arkadiko 1.9%
docs.stacks.co, What's Changed in PoX-5: "PoX-5 accumulates rewards as sBTC."
$ clarinet check
Overwrite? [Y/n]   (the simnet deployment plan, gitignored)
✔ 14 contracts checked
~~~

### E-023 output
~~~text
$ npx vitest run --config vitest.testnet.config.ts --silent=false --reporter=verbose
  deposit 100000 sats      : idle 100000 | vault sBTC 100000 | owner wallet 1351720000 before
  delegate allocates       : (ok u100000) | vault holds 100000 shares | venue sBTC 100000 | vault sBTC 0
  delegate unwinds         : (ok u100000) | idle 100000 | vault sBTC 100000 | venue sBTC 0
  owner withdraws          : (ok true) | wallet change 0 | vault sBTC 0
  2% haircut, 1% limit     : (err u201) | idle 100000 | vault sBTC 100000
 Test Files  1 passed (1)
      Tests  2 passed (2)
~~~

### E-024 output
~~~text
$ npm run testnet
deployer ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5
  sip-010-trait     already deployed, identical to the repo   0x166a1bab5b3105827474def3ee7db1635006818573490b89f7ef8781538f23ee
  venue-trait       already deployed, identical to the repo   0xd5fde87dbd1c870bc8b522f169cce570e3ff7e989530545ff7f254c3c245066b
  mandate-vault-v3  already deployed, identical to the repo   0x26400b07e407980984c89c9da2cf61ff469202e4c14eb97af4241e3a91700ce6
  mock-venue-sbtc   0x086d9b94b07098b68399dfabc75e5716329b8f81b7a8bbb5ef8e0de4a65497c4 ... block 719933
wrote deployments/testnet.json
owner ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5
delegate ST3TMSRWZJ2F50307Q1A5B6KXY4YZ6CTW66D2BWFW
  owner allowlists testnet sBTC  0x558e9850c2e5db6dff14f1d01927e17353acc221d85a44584dbee9191cce9f98 ... (ok true), block 719935
  owner allowlists the venue     0xc52068ae8706188434073581d7b6c2185235ea6720496d04cb55466e3da6eacc ... (ok true), block 719937
  owner deposits 20,000 sats     0xd210c8dd03fa8051bbd01d00082f883b76c5997c6b64d24f75a46b210bb75de5 ... (ok true), block 719939
  owner grants the delegate      0x085c254f86569275e8bfa0cac65152a84875dde97ea676d55cc801159a25fbf9 ... (ok true), block 719941
  delegate allocates 10,000      0x1f5c17e483098fdbd11fe14f7f083b50d02febc1c5efdb81ba9e0faad63edbf4 ... (ok u10000), block 719943
  delegate unwinds 10,000        0xa7be818fc0711f31c6f372f1e7755e3506d8dcd0c4122f84b1c330d57fd815b6 ... (ok u10000), block 719945
  owner withdraws 20,000 sats    0xbf277b197ad41ffc5816129ebc3c2463f7954d6baeba25b3b89d3599333f061a ... (ok true), block 719947
books reconcile, before: {"ownerIdleInVault":"u0","ownerPosition":"u0","ownerSbtc":"(ok u230000)","vaultSbtc":"(ok u0)","venueSbtc":"(ok u0)"} 
                  after:  {"ownerIdleInVault":"u0","ownerPosition":"u0","ownerSbtc":"(ok u230000)","vaultSbtc":"(ok u0)","venueSbtc":"(ok u0)"}
wrote deployments/testnet-run.json
exit 0 · elapsed 126 s

$ npm run testnet:verify
contracts deployed by ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5:
  ok   sip-010-trait     block 719259, Clarity 4, source identical to the repo
  ok   venue-trait       block 719260, Clarity 4, source identical to the repo
  ok   mandate-vault-v3  block 719267, Clarity 4, source identical to the repo
  ok   mock-venue-sbtc   block 719933, Clarity 4, source identical to the repo
end-to-end run, owner ST3K5BMJE4CNKSQ3A2DT7JTXB2MJYW8892ASVWQV5, delegate ST3TMSRWZJ2F50307Q1A5B6KXY4YZ6CTW66D2BWFW:
  ok   owner allowlists testnet sBTC    success, block 719935, (ok true)
  ok   owner allowlists the venue       success, block 719937, (ok true)
  ok   owner deposits 20,000 sats       success, block 719939, (ok true)
  ok   owner grants the delegate        success, block 719941, (ok true)
  ok   delegate allocates 10,000        success, block 719943, (ok u10000)
  ok   delegate unwinds 10,000          success, block 719945, (ok u10000)
  ok   owner withdraws 20,000 sats      success, block 719947, (ok true)
all 11 checks pass

# transfer events, from the testnet API
deposit   transfer  sbtc-token        20000  owner -> vault
allocate  transfer  sbtc-token        10000  vault -> venue
allocate  mint      mock-venue-sbtc   10000  -> vault
unwind    burn      mock-venue-sbtc   10000  vault ->
unwind    transfer  sbtc-token        10000  venue -> vault
withdraw  transfer  sbtc-token        20000  vault -> owner

# account 1: 486.28 STX before and 485.28 after (one deployment, five calls); 230,000 sats of testnet sBTC before and after
~~~

### E-025 output
~~~text
$ gh api /advisories/GHSA-68fv-2mgg-jv7q
GHSA-68fv-2mgg-jv7q · high · source-map-js allows event-loop denial of service through indexed source-map section offsets
  npm/source-map-js: vulnerable >= 1.0.0, < 1.2.2, patched 1.2.2

$ npm audit fix          (package-lock.json: source-map-js 1.2.1 -> 1.2.2)
$ npm audit
found 0 vulnerabilities

$ npx vitest run tests/v3-hostile.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
~~~

### E-026 output
~~~text
$ npx vitest run tests/v4.test.ts --silent=false --reporter=verbose
  at the cap, 1 sat more   : (err u117) | principal u1000000 of cap u1000000 | vault (ok u1000000)
  after withdrawing 300000 : principal u700000 of cap u1000000
  no cap set, deposit 1    : (err u117) | cap u0 | vault (ok u0)
  stranger, zero, set, raise, other asset: (err u118) (err u116) (ok true) (err u119) (ok true) | cap u1000000
 Test Files  1 passed (1)
      Tests  33 passed (33)

$ npx vitest run tests/v4.test.ts tests/v4-hostile.test.ts tests/v4-zest-fork.test.ts   # before the cap tests were added
 Test Files  3 passed (3)
      Tests  42 passed (42)

$ npx vitest run
 Test Files  17 passed (17)
      Tests  77 passed (77)
exit 0 in 431 s
~~~

### E-027 output
~~~text
$ npx vitest run tests/phishing.test.ts --silent=false --reporter=verbose
  v3, alice claims airdrop : (ok u400000) | alice idle u0 | position u400000 | phish venue holds (ok u400000) | alice unwinds: (err u404)
  v4, alice claims airdrop : (err u100) | alice idle u400000 | position u0 | phish venue holds (ok u0)
  contract owner           : deposit (ok true) | idle u50000 | withdraw (ok true) | its tokens (ok u50000)
 Test Files  1 passed (1)
      Tests  3 passed (3)

$ npx vitest run tests/v4.test.ts tests/v4-hostile.test.ts tests/v4-zest-fork.test.ts tests/phishing.test.ts
  re-enters the vault      : (err u105) | u400000 | u0 | (ok u400000) | (ok u0)
 Test Files  4 passed (4)
      Tests  49 passed (49)

$ npx vitest run
 Test Files  18 passed (18)
      Tests  80 passed (80)
exit 0 in 355 s
~~~
