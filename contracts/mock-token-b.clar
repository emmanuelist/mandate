;; Tests only: a second local token, standing in for an asset nobody allowlisted (#45).
;; minimal SIP-010 so the ledger can be exercised in simnet
(impl-trait .sip-010-trait.sip-010-trait)
(define-fungible-token mock-b)
(define-constant ERR_NOT_OWNER (err u4))

(define-public (mint (amount uint) (to principal)) (ft-mint? mock-b amount to))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) ERR_NOT_OWNER)
    (try! (ft-transfer? mock-b amount sender recipient))
    (ok true)))

(define-read-only (get-name) (ok "mock-b"))
(define-read-only (get-symbol) (ok "MOCKB"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock-b who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock-b)))
(define-read-only (get-token-uri) (ok none))
