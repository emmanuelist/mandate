# Mainnet runbook

This runbook takes Mandate's vault to Stacks mainnet (#34), and lists what follows it:
the live mandate (#35) and the refusals on the record (#36). Every mainnet transaction
is signed with the owner's key, on the owner's command. The scripts read the seed only
when told to broadcast, in their own process, and never print it.

## What goes to mainnet

| Contract | Role | Size |
| --- | --- | --- |
| `sip-010-trait` | The standard token trait, included so one source deploys on every network (D-014) | 1,211 bytes |
| `venue-trait` | The interface the vault requires of a venue; Zest's sBTC vault conforms as deployed (D-009) | 588 bytes |
| `mandate-vault-v5` | The vault (D-022) | 18,392 bytes |
| `granite-venue` | The adapter for Granite's USDCx lending pool, the second venue (D-020) | 3,758 bytes |

`Clarinet-review.toml` lists these four, and the static checks use the same list. The
repo's source is what is deployed: a contract already on mainnet with different source
stops the run, since a name cannot be deployed twice.

After deploying, the deployer sets each asset's cap once. Nothing can raise a cap
afterwards; a higher one means a new deployment, after an audit (D-008, D-018, D-020).

| Asset | Cap |
| --- | --- |
| sBTC, `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token` | 1,000,000 sats (0.01 BTC) |
| USDCx, `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` | 1,000,000,000 units (1,000 USDCx at 6 decimals) |

## Before you start

- `settings/Mainnet.toml` holds the seed whose first account,
  `SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH`, deploys the contracts and owns the vault's
  caps. The file is excluded from version control. Never paste the seed into a chat, an
  issue or a commit.
- The deployer held 188.34 STX on 2026-10-14, far more than the deployment needs.
- v5 has been rehearsed on testnet: deployed from the same source, run end to end, and
  driven by the reference delegate, with refusals on the record (#52, E-037).

## Step 1: dry run

    npm run mainnet:deploy

The dry run reads no key and signs nothing. For each step it prints Hiro's low, medium
and high fee estimates, then the total at the medium against the deployer's balance.
On 2026-10-14 it printed:

| Step | Signed by | Fee at the medium estimate |
| --- | --- | --- |
| Deploy `sip-010-trait` | the deployer | 0.605 STX |
| Deploy `venue-trait` | the deployer | 0.605 STX |
| Deploy `mandate-vault-v5` | the deployer | 0.608 STX |
| Deploy `granite-venue` | the deployer | 0.606 STX |
| Set sBTC's cap | the deployer | budgeted at 0.608 STX |
| Set USDCx's cap | the deployer | budgeted at 0.608 STX |
| Total | | 3.64 STX |

The estimates follow the fee market. Within ten minutes on 2026-10-14, the medium
estimate for a deploy ranged from 0.61 to 1.23 STX. Setting a cap has no estimate until
the vault exists, so the dry run budgets each at the highest deploy estimate; a contract
call costs less than a deploy.

## Step 2: broadcast

    npm run mainnet:deploy -- --broadcast

The broadcast run:

- reads the seed from `settings/Mainnet.toml`, and stops unless its first account is
  the deployer above;
- deploys each contract that is not yet on mainnet, in order, each confirmed before the
  next, and skips one already deployed with identical source;
- pays each transaction's medium estimate, and stops rather than pay more than 2 STX for
  any one of them;
- sets each cap that is unset, then reads it back from the vault; a cap already set must
  match the one above;
- writes `deployments/mainnet.json` as it goes, so a run that stops can be resumed.

A transaction usually confirms within minutes; the run waits up to an hour for each.

## Step 3: verify

    npm run mainnet:verify

The verification needs no keys, so anyone with a clone can run it. It checks each
contract in `deployments/mainnet.json` against the repo's source and Clarity version,
and reads each cap back from the vault.

## After the deployment

- **The live mandate (#35).** The owner funds a mandate with real sBTC and about
  20 USDCx, and grants it to the reference delegate. The owner creates the delegate's key
  with `npm run delegate:key -- mainnet` and funds it with STX for fees. At least ten
  transactions follow: at least four allocations by the delegate, two unwinds and an
  owner withdrawal, across Zest and Granite. The owner's mainnet tooling comes with #35.
- **Refusals on the record (#36).** The delegate attempts calls its mandate forbids with
  `npm run delegate -- mainnet attempt <kind>`, as it did on testnet (D-024, E-037).

## Earlier: the mainnet probe

Before the vault, a minimal probe contract showed that a Clarity contract can deposit
real sBTC into Zest's mainnet vault and withdraw it (E-001, E-002). The contract ended
holding no sBTC and no Zest shares, for about 0.405 STX in fees.
`run-mainnet-proof.mjs` made the four calls.

    contract  SP24BN6HQCT1B37TD9MDJ3Y3BEZCMG9V1Y9985AGH.mandate-probe-mainnet
    deploy    0x77489c3697c99efd83ada94c9ebbd681b26d07b21949c842d28386a671a42ebc  block 8,878,880, fee 0.393381 STX
    fund      0x8251abef4b4c76dc588c54722098f0fdc8860157602cf501e0815f2036b03df6  (ok true)
    allocate  0x8fa8b392a30e7786860e187a7c0cf62e5aa812150dbb0bfec1c324bd9e7fa121  (ok u99)
    unwind    0xfc168e4b2b7b9037742f240ac2624c64ce9ad14ac4959f16fd82996f0640695e  (ok u99)
    rescue    0xd9dda0d85334e5cac65445927b0bc9e5611db578ba73afe8a5d7b87f7049a074  (ok true)
