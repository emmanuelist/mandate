;; mandate-probe -- minimal MAINNET proof, owner-only.
;;
;; Proves the one thing forked state cannot: that a real broadcast works.
;;   1. a CONTRACT can deposit sBTC into Zest and receive shares
;;   2. it can redeem those shares back to sBTC
;;   3. the owner -- and only the owner -- can get the funds out again
;;
;; Rule 3 is not optional. Without `rescue` any sBTC sent here is trapped:
;; `unwind` returns sats to the CONTRACT, not to a person.

(use-trait sip-010 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)

(define-constant ZEST 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-sbtc)
(define-constant OWNER tx-sender)              ;; the deployer, fixed at deploy time
(define-constant ERR_NOT_OWNER (err u401))

(define-read-only (get-owner) OWNER)

;; anyone may add funds; only the owner may ever move them
(define-public (fund (token <sip-010>) (amount uint))
  (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

(define-public (allocate (amount uint) (min-out uint))
  (begin
    (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
    (as-contract (contract-call? ZEST deposit amount min-out tx-sender))))

(define-public (unwind (shares uint) (min-out uint))
  (begin
    (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
    (as-contract (contract-call? ZEST redeem shares min-out tx-sender))))

;; the exit. Pays OWNER and nobody else.
(define-public (rescue (token <sip-010>) (amount uint))
  (begin
    (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
    (as-contract (contract-call? token transfer amount tx-sender OWNER none))))
