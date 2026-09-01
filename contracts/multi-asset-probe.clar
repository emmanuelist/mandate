;; One adapter, any Zest vault.
;; Both v0-vault-sbtc and v0-vault-stx impl-trait .vault-traits.tokenized-vault,
;; so the vault is a parameter rather than a hardcoded constant. wstx presents
;; native STX behind SIP-010, so an STX holder needs no wrapping step.
(use-trait sip-010 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait zvault 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.vault-traits.tokenized-vault)

(define-constant OWNER tx-sender)
(define-constant ERR_NOT_OWNER (err u401))

(define-public (fund (token <sip-010>) (amount uint))
  (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

(define-public (allocate (vault <zvault>) (amount uint) (min-out uint))
  (begin
    (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
    (as-contract (contract-call? vault deposit amount min-out tx-sender))))

(define-public (unwind (vault <zvault>) (shares uint) (min-out uint))
  (begin
    (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
    (as-contract (contract-call? vault redeem shares min-out tx-sender))))

(define-public (rescue (token <sip-010>) (amount uint))
  (begin
    (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
    (as-contract (contract-call? token transfer amount tx-sender OWNER none))))
