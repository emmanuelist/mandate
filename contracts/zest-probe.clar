;; Can a mandate vault allocate its own sBTC into Zest?
;; Zest binds (account contract-caller) and puts no is-standard guard on recipient,
;; so a contract should be a first-class depositor -- unlike the Bitflow pools.
(use-trait sip-010 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(define-constant ZEST 'SP1A27KFY4XERQCCRCARCYD1CC5N7M6688BSYADJ7.v0-vault-sbtc)

(define-public (fund (token <sip-010>) (amount uint))
  (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

;; the vault allocates its own balance into Zest and keeps the shares
(define-public (allocate (amount uint) (min-out uint))
  (as-contract (contract-call? ZEST deposit amount min-out tx-sender)))

(define-public (unwind (shares uint) (min-out uint))
  (as-contract (contract-call? ZEST redeem shares min-out tx-sender)))
