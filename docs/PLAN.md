# Plan
Milestones and their exit criteria. GitHub milestones mirror this table, with identical titles. A date moves only by a new entry in `docs/DECISIONS.md`.

| # | Milestone | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|
| M1 | Core Vault + Zest Adapter on Testnet | Vault deployed to testnet with a public address. A testnet run in which a funded mandate allocates to a yield venue, unwinds, and an owner withdrawal returns the funds. A public repository with contract code, Clarinet tests, deployment details and setup instructions. A published protocol specification: policy model, authorization flow, threat model, non-goals. | 2026-10-31 | in progress (#3 to #9) |
| M2 | Mainnet Launch + Adversarial Suite | Vault on mainnet with a contract-enforced per-vault AUM cap. At least 10 mainnet transactions from a live mandate, including at least 4 delegate allocations, 2 unwinds and 1 owner withdrawal. At least 3 out-of-policy attempts refused on mainnet, each with the attempted call, the policy, the refusal and no asset movement. At least 40 hostile-delegate cases, all refused, running in public CI. A second venue adapter on mainnet behind the same trait. A structured review: threat model, invariant tests, adversarial tests, static checks and a published findings log. Proposed: a documented review with at least one prospective operator, published as an integration requirements note (D-003). | 2026-12-05 | not started (#1) |
| M3 | Policy Compiler + Agent SDK + Continuation Roadmap | A policy compiler CLI producing a typed policy, a plain-English restatement and the exact Clarity arguments. The mandate-agent trait and a TypeScript adapter SDK, with documentation and a working quickstart. A ledger indexer and public page showing each allocation's quoted versus realised output and slippage in basis points. At least 20 policy-approved mainnet allocations across at least 3 mandates, each with a published record. At least 1 reference adapter on mainnet against a public MIT-licensed Stacks agent, or evidence of integration readiness with an agreed replacement check if outside conditions prevent it. MIT licence. A continuation roadmap. | 2027-01-30 | not started (#2) |

## Cut list
Deliberately not being built. Each entry links the decision that cut it.
- Trading on Bitflow's pools: they refuse a contract as recipient (D-002).
- Exit criteria that wait on another team (D-003).
- An owner-facing app as a committed deliverable; M3 commits to the public ledger page (D-007).
- An external audit at this stage; the AUM cap bounds exposure until one is done (D-008).
