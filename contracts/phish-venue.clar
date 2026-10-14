;; Tests only: a venue an attacker controls. It has the venue trait's shape, takes
;; what it's given, and never pays anything back (#40).
(define-fungible-token pshare)

(define-read-only (convert-to-shares (amount uint)) (ok amount))
(define-read-only (convert-to-assets (shares uint)) (ok shares))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance pshare who)))

(define-public (deposit (amount uint) (min-out uint) (recipient principal))
  (let ((payer contract-caller)
        (me (try! (as-contract? () tx-sender))))
    (try! (contract-call? .mock-token transfer amount payer me none))
    (try! (ft-mint? pshare amount recipient))
    (ok amount)))

(define-public (redeem (shares uint) (min-out uint) (recipient principal))
  (err u404))
