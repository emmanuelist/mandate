# Mainnet proof runbook

## STATUS: deployed

    contract : SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet
    deploy tx: 0x77489c3697c99efd83ada94c9ebbd681b26d07b21949c842d28386a671a42ebc
    block    : 8878880   fee: 0.393381 STX   status: success
    get-owner: SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH  (matches deployer)

## COMPLETE

    fund     0x8251abef4b4c76dc588c54722098f0fdc8860157602cf501e0815f2036b03df6  (ok true)
    allocate 0x8fa8b392a30e7786860e187a7c0cf62e5aa812150dbb0bfec1c324bd9e7fa121  (ok u99)   <- the proof
    unwind   0xfc168e4b2b7b9037742f240ac2624c64ce9ad14ac4959f16fd82996f0640695e  (ok u99)
    rescue   0xd9dda0d85334e5cac65445927b0bc9e5611db578ba73afe8a5d7b87f7049a074  (ok true)

Contract ended with 0 sBTC and 0 Zest shares. Total cost ~0.405 STX.
Steps below are kept for reference / re-running.

Run them with:

    node run-mainnet-proof.mjs               # dry run, signs nothing
    AMOUNT=100 node run-mainnet-proof.mjs --broadcast

The script reads your seed from settings/Mainnet.toml, signs locally, and prints
the four hashes. The seed is never printed or sent anywhere but the Stacks node.

Minimum workable size is 2 sats — 1 sat rounds to zero shares and trips Zest's
ERR-SLIPPAGE (u801010). 100 sats is the suggested default: unambiguous, and about
eleven cents.


Goal: turn "proven against forked state" into four mainnet transaction hashes anyone
can verify on a public explorer.

Deploying `mandate-probe-mainnet.clar` only. Not the full vault — this proves the one
claim forked state cannot: that a real broadcast works.

## Before you start

- A **fresh** Stacks wallet. Not your main one.
- **~5 STX** for the deploy plus four contract calls.
- **~10,000 sats sBTC** (about $11). Any amount works; small is the point.
- Never paste your seed phrase into a chat, an issue, or a commit.
  `settings/Mainnet.toml` is gitignored — keep it that way.

## Steps

1. Put your seed phrase in `settings/Mainnet.toml` (replace the placeholder).

2. Generate the plan:

       clarinet deployments generate --mainnet --medium-cost

   **The generated plan is wrong and must be trimmed.** Clarinet includes every
   contract in `Clarinet.toml`, which here means all seven — the original buggy
   spike, a token with an open `mint`, and `zest-probe` which has no exit. Deploying
   those would cost 2.944 STX instead of 0.393 and would publish known-broken code
   under your address permanently.

   The trimmed plan in this repo already contains only `mandate-probe-mainnet`.
   Confirm it still does:

       grep -c contract-publish deployments/default.mainnet-plan.yaml   # must print 1

   If you regenerate, it will be overwritten and you must trim it again. The
   generated version is kept at `default.mainnet-plan.yaml.generated.bak` for
   reference.

3. Deploy using the on-disk plan, so Clarinet does not recompute it:

       clarinet deployments apply --mainnet --use-on-disk-deployment-plan

   Without that flag it may regenerate and redeploy all seven.

4. Send sBTC to the deployed contract by calling `fund`, then run the three calls in
   order. Use the Hiro explorer sandbox or `stx` CLI:

   Easiest route is the Hiro explorer sandbox:
   https://explorer.hiro.so/sandbox/contract-call?chain=mainnet
   Paste the contract address, pick the function, connect the deployer wallet.

   Dry-run values from forked mainnet at 7,000 sats — yours should be within a
   sat or two, since Zest shares accrue between blocks:

   | # | Call | Arguments | Expected |
   |---|------|-----------|----------|
   | 1 | `fund` | `sbtc-token`, `7000` | `(ok true)` |
   | 2 | `allocate` | `7000`, `1` | `(ok u6996)` <- **the proof** |
   | 3 | `unwind` | *shares from step 2*, `1` | `(ok u6999)` |
   | 4 | `rescue` | `sbtc-token`, *sats from step 3* | `(ok true)` |

   The sBTC token argument is the principal
   `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`.

   Use the value step 2 actually returns for step 3 — do not hardcode 6996.
   Same for step 4. The `min-out` of `1` is deliberately permissive for a probe
   this small; the real vault derives it from policy.

   Post-conditions: step 1 moves sBTC out of *your wallet*; steps 2-4 move it out
   of *the contract*. If the explorer blocks a call on post-conditions, set Allow
   mode — the amounts are trivial and the contract is owner-only.

5. Collect the four `0x…` transaction hashes. Those go in the application.

## Sanity

- Call 2 is the one that matters. On Bitflow the equivalent returns `(err u3003)`.
- If call 2 fails, do **not** retry blindly — read the error and check it against
  `tests/zest-fork.test.ts`, which passes against the same contracts.
- `rescue` is owner-only and pays the deployer. Without it, funds sent here would be
  trapped: `unwind` returns sats to the *contract*, not to you.

## Cost

Deploy is the only real cost, roughly 0.1–1 STX for a contract this size, plus four
small call fees. Budget 5 STX and you will not run out.
