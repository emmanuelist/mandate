;; Probe A: literal token name.  Probe B: "*" wildcard with a RUNTIME principal.
;; Correct form per docs: try! INSIDE the body so the last expr is not a response.
(use-trait sip-010 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)
(define-constant BF 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)

;; A: runtime principal + literal asset name
(define-public (probe-a (token <sip-010>) (amount uint) (to principal))
  (as-contract? ((with-ft (contract-of token) "sbtc-token" amount))
    (try! (contract-call? token transfer amount tx-sender to none))))

;; B: runtime principal + wildcard asset name
(define-public (probe-b (token <sip-010>) (amount uint) (to principal))
  (as-contract? ((with-ft (contract-of token) "*" amount))
    (try! (contract-call? token transfer amount tx-sender to none))))

;; C: the shape mandate-vault-v2 actually needs -- bounded swap through Bitflow
(define-public (probe-swap
    (pool <xyk-pool>) (x-token <sip-010>) (y-token <sip-010>)
    (x-amount uint) (floor uint))
  (as-contract? ((with-ft (contract-of x-token) "*" x-amount))
    (try! (contract-call? BF swap-x-for-y pool x-token y-token x-amount floor))))
