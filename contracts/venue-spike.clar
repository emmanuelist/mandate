;; Spike for #4: can a contract reach Zest's v0-vault-sbtc through its own venue
;; trait, which Zest never declares? If so, Zest needs no adapter: the vault is
;; Zest's contract-caller, pays for itself and holds its own shares.
;; Test-only: these entry points are permissionless.
(use-trait venue .venue-trait.venue)
(use-trait ft 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-public (quote-in (v <venue>) (amount uint))
  (contract-call? v convert-to-shares amount))

(define-public (quote-out (v <venue>) (shares uint))
  (contract-call? v convert-to-assets shares))

(define-public (allocate (v <venue>) (asset <ft>) (amount uint) (min-out uint))
  (let ((me (try! (as-contract? () tx-sender))))
    (as-contract? ((with-ft (contract-of asset) "*" amount))
      (try! (contract-call? v deposit amount min-out me)))))

(define-public (unwind (v <venue>) (shares uint) (min-out uint))
  (let ((me (try! (as-contract? () tx-sender))))
    (as-contract? ((with-ft (contract-of v) "*" shares))
      (try! (contract-call? v redeem shares min-out me)))))
