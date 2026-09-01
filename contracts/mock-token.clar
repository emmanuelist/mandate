;; minimal SIP-010 so the ledger can be exercised in simnet
(impl-trait 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(define-fungible-token mock)
(define-constant ERR_NOT_OWNER (err u4))

(define-public (mint (amount uint) (to principal)) (ft-mint? mock amount to))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) ERR_NOT_OWNER)
    (try! (ft-transfer? mock amount sender recipient))
    (ok true)))

(define-read-only (get-name) (ok "mock"))
(define-read-only (get-symbol) (ok "MOCK"))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mock who)))
(define-read-only (get-total-supply) (ok (ft-get-supply mock)))
(define-read-only (get-token-uri) (ok none))
