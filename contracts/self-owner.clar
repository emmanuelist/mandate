;; Tests only: a contract that owns funds in the vault and acts for itself, as a
;; multisig or a DAO treasury would. It calls the vault from inside as-contract?,
;; so the vault sees it as both tx-sender and contract-caller (#40).
(define-public (deposit (amount uint))
  (as-contract? ((with-ft .mock-token "*" amount))
    (unwrap-panic (contract-call? .mandate-vault-v4 allow-asset .mock-token))
    (try! (contract-call? .mandate-vault-v4 deposit .mock-token amount))))

(define-public (withdraw (amount uint))
  (as-contract? ()
    (try! (contract-call? .mandate-vault-v4 withdraw .mock-token amount))))
