;; reentrant-venue, aimed at mandate-vault-v4 to show the flaw v5 fixes (#48).
;; Tests only: never allowlist it. Same hooks and interface; only the two calls
;; that move the vault's tokens: act u1 deposits `amount` of its own tokens, and
;; any other act withdraws `amount` of its idle.
(define-fungible-token rshare)
(define-constant ERR_MIN_OUT (err u201))

(define-data-var hook uint u0)
(define-data-var act uint u0)
(define-data-var amount uint u0)
(define-data-var owner principal tx-sender)
(define-data-var strict bool true)
(define-data-var reads uint u0)
(define-data-var attempts uint u0)
(define-data-var refusals uint u0)

(define-public (arm (h uint) (a uint) (x uint) (o principal) (s bool))
  (begin (var-set hook h) (var-set act a) (var-set amount x) (var-set owner o) (var-set strict s) (var-set reads u0) (ok true)))

;; v4's allowlist functions never return an error, so their error type is unknown
(define-public (setup) (begin (unwrap-panic (contract-call? .mandate-vault-v4 allow-asset .mock-token)) (ok true)))

;; withdraw this venue's own idle balance from the vault
(define-public (take (x uint)) (contract-call? .mandate-vault-v4 withdraw .mock-token x))

(define-read-only (shares-held (who principal)) (ft-get-balance rshare who))
(define-read-only (tally) { attempts: (var-get attempts), refusals: (var-get refusals) })

(define-private (call-vault)
  (let ((x (var-get amount)))
    (if (is-eq (var-get act) u1)
        (as-contract? ((with-ft .mock-token "*" x))
          (try! (contract-call? .mandate-vault-v4 deposit .mock-token x)))
        (contract-call? .mandate-vault-v4 withdraw .mock-token x))))

(define-private (maybe (h uint))
  (if (is-eq (var-get hook) h)
      (begin
        (var-set hook u0)
        (var-set attempts (+ (var-get attempts) u1))
        (match (call-vault)
          ok-v (ok true)
          err-v (begin (var-set refusals (+ (var-get refusals) u1))
                       (if (var-get strict) (err err-v) (ok true)))))
      (ok true)))

(define-public (get-balance (who principal))
  (begin
    (var-set reads (+ (var-get reads) u1))
    (if (is-eq (var-get reads) u2) (try! (maybe u3)) true)
    (ok (ft-get-balance rshare who))))
(define-public (convert-to-shares (assets uint)) (begin (try! (maybe u4)) (ok assets)))
(define-public (convert-to-assets (shares uint)) (begin (try! (maybe u5)) (ok shares)))

(define-public (deposit (assets uint) (min-out uint) (recipient principal))
  (let ((payer contract-caller) (me (try! (as-contract? () tx-sender))))
    (asserts! (>= assets min-out) ERR_MIN_OUT)
    (try! (contract-call? .mock-token transfer assets payer me none))
    (try! (maybe u1))
    (try! (ft-mint? rshare assets recipient))
    (ok assets)))

(define-public (redeem (shares uint) (min-out uint) (recipient principal))
  (let ((holder contract-caller))
    (asserts! (>= shares min-out) ERR_MIN_OUT)
    (try! (ft-burn? rshare shares holder))
    (try! (as-contract? ((with-ft .mock-token "*" shares))
      (try! (contract-call? .mock-token transfer shares tx-sender recipient none))))
    (try! (maybe u2))
    (ok shares)))
