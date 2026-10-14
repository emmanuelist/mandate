;; A venue that calls back into the vault on purpose (#48). Tests only: never
;; allowlist it. It is an honest 1:1 venue for mock-token, except that once armed,
;; one of its functions makes one call into mandate-vault-v5, as the venue itself.
;;   hook: u1 deposit, u2 redeem, u3 the balance read after either, u4 the share
;;         quote, u5 the asset quote. Its getter and quotes are public functions,
;;         which the venue trait allows, so they can call out too.
;;   act:  u1 deposit `amount` of its own tokens, u2 withdraw `amount` of its idle,
;;         u3 allocate `amount` of `owner`'s idle into mock-venue, u4 unwind
;;         `amount` of `owner`'s shares there, u5 exit `amount` of its own shares
;;         there, u6 grant `owner` a mandate, u7 list mock-venue for itself
;;   strict: pass the vault's refusal on as the venue's own error; otherwise
;;         ignore it and carry on honestly.
;; It counts the calls it attempted and the ones the vault refused.
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

;; list mock-token in the vault for this venue, so it can deposit as an owner
(define-public (setup) (contract-call? .mandate-vault-v5 allow-asset .mock-token))

;; withdraw this venue's own idle balance from the vault
(define-public (take (x uint)) (contract-call? .mandate-vault-v5 withdraw .mock-token x))

(define-read-only (shares-held (who principal)) (ft-get-balance rshare who))
(define-read-only (tally) { attempts: (var-get attempts), refusals: (var-get refusals) })

(define-private (as-bool (r (response uint uint))) (match r ok-v (ok true) err-v (err err-v)))

;; one call into the vault, as this venue
(define-private (call-vault)
  (let ((a (var-get act)) (x (var-get amount)) (o (var-get owner)))
    (if (is-eq a u1) (as-contract? ((with-ft .mock-token "*" x))
                       (try! (contract-call? .mandate-vault-v5 deposit .mock-token x)))
    (if (is-eq a u2) (contract-call? .mandate-vault-v5 withdraw .mock-token x)
    (if (is-eq a u3) (as-bool (contract-call? .mandate-vault-v5 allocate o .mock-venue .mock-token x))
    (if (is-eq a u4) (as-bool (contract-call? .mandate-vault-v5 unwind o .mock-venue .mock-token x))
    (if (is-eq a u5) (as-bool (contract-call? .mandate-vault-v5 owner-unwind .mock-venue .mock-token x u0))
    (if (is-eq a u6) (contract-call? .mandate-vault-v5 grant o u1 u999999999 u100 u1 u1 u1 u100)
                     (contract-call? .mandate-vault-v5 allow-venue .mock-venue .mock-token)))))))))

;; fire the armed call once, at the armed hook
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
    ;; the vault reads before and after each deposit or redeem: fire on the read after
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
