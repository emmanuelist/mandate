;; Tests only: a contract that owns funds in the vault and acts for itself, as a
;; multisig or a DAO treasury would. It calls the vault from inside as-contract?,
;; so the vault sees it as both tx-sender and contract-caller (#40).
(define-public (deposit (amount uint))
  (as-contract? ((with-ft .mock-token "*" amount))
    (try! (contract-call? .mandate-vault-v5 allow-asset .mock-token))
    (try! (contract-call? .mandate-vault-v5 deposit .mock-token amount))))

(define-public (withdraw (amount uint))
  (as-contract? ()
    (try! (contract-call? .mandate-vault-v5 withdraw .mock-token amount))))

;; two calls into the vault in one transaction: an exit the vault refuses, since
;; this contract holds no position, then a deposit, which must still go through.
;; The refused call closed the vault while it ran (#48).
(define-public (refused-then-deposit (amount uint))
  (begin
    (asserts! (is-err (contract-call? .mandate-vault-v5 owner-unwind .mock-venue .mock-token u1 u0)) (err u1))
    (deposit amount)))
