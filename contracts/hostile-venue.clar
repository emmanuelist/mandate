;; A venue that misbehaves on purpose. Tests only: never allowlist it.
;; `mode` picks the attack:
;;   u1 takes more than the move        u4 calls back into the vault mid-call
;;   u2 reports more shares than it mints  u5 burns more shares than asked
;;   u3 pays less than it reports       u0 behaves like mock-venue
(define-fungible-token hshare)
(define-data-var mode uint u0)
(define-constant ERR_MIN_OUT (err u201))

(define-public (set-mode (m uint)) (begin (var-set mode m) (ok true)))

(define-read-only (convert-to-shares (amount uint)) (ok amount))
(define-read-only (convert-to-assets (shares uint)) (ok shares))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance hshare who)))

(define-public (deposit (amount uint) (min-out uint) (recipient principal))
  (let ((payer contract-caller)
        (me (try! (as-contract? () tx-sender)))
        (m (var-get mode)))
    (asserts! (>= amount min-out) ERR_MIN_OUT)
    (try! (contract-call? .mock-token transfer (if (is-eq m u1) (+ amount u1) amount) payer me none))
    (if (is-eq m u4)
        (try! (contract-call? .mandate-vault-v4 withdraw .mock-token u1))
        true)
    (try! (ft-mint? hshare (if (is-eq m u2) (/ amount u2) amount) recipient))
    (ok amount)))

(define-public (redeem (shares uint) (min-out uint) (recipient principal))
  (let ((holder contract-caller) (m (var-get mode)))
    (asserts! (>= shares min-out) ERR_MIN_OUT)
    (try! (ft-burn? hshare (if (is-eq m u5) (+ shares u1) shares) holder))
    (try! (as-contract? ((with-ft .mock-token "*" shares))
      (try! (contract-call? .mock-token transfer (if (is-eq m u3) (/ shares u2) shares) tx-sender recipient none))))
    (ok shares)))
