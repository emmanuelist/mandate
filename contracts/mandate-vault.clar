;; mandate-vault -- SPIKE
;; Question under test: can a Clarity contract holding its own assets drive
;; Bitflow's xyk-core swap via `as-contract`, passing trait references through?

(use-trait sip-010 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)

(define-constant ERR_NO_MANDATE   (err u100))
(define-constant ERR_NOT_AGENT    (err u101))
(define-constant ERR_TOO_LARGE    (err u102))
(define-constant ERR_EXPIRED      (err u103))
(define-constant ERR_NOT_OWNER    (err u104))

;; owner -> mandate
(define-map mandates
  { owner: principal }
  { agent: principal, max-notional: uint, expires: uint })

;; agent -> owner  (reverse lookup so the agent can be resolved from tx-sender)
(define-map agent-of { agent: principal } { owner: principal })

(define-public (grant (agent principal) (max-notional uint) (expires uint))
  (begin
    (map-set mandates { owner: tx-sender }
             { agent: agent, max-notional: max-notional, expires: expires })
    (map-set agent-of { agent: agent } { owner: tx-sender })
    (ok true)))

(define-public (revoke (agent principal))
  (let ((rev (unwrap! (map-get? agent-of { agent: agent }) ERR_NO_MANDATE)))
    (asserts! (is-eq (get owner rev) tx-sender) ERR_NOT_OWNER)
    (map-delete mandates { owner: tx-sender })
    (map-delete agent-of { agent: agent })
    (ok true)))

;; THE TEST: policy-gated swap executed as the vault contract itself.
(define-public (execute
    (pool     <xyk-pool>)
    (x-token  <sip-010>)
    (y-token  <sip-010>)
    (x-amount uint)
    (min-dy   uint))
  (let (
      (rev (unwrap! (map-get? agent-of { agent: tx-sender }) ERR_NO_MANDATE))
      (m   (unwrap! (map-get? mandates { owner: (get owner rev) }) ERR_NO_MANDATE)))
    ;; policy gate -- plain integer comparisons, no oracle
    (asserts! (is-eq tx-sender (get agent m))          ERR_NOT_AGENT)
    (asserts! (<= x-amount (get max-notional m))       ERR_TOO_LARGE)
    (asserts! (< burn-block-height (get expires m))    ERR_EXPIRED)
    ;; the vault becomes tx-sender, so tokens move from and to the vault
    (as-contract
      (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2
        swap-x-for-y pool x-token y-token x-amount min-dy))))

;; owner-only exit
(define-public (withdraw (token <sip-010>) (amount uint))
  (let ((owner tx-sender))
    (asserts! (is-some (map-get? mandates { owner: owner })) ERR_NO_MANDATE)
    (as-contract (contract-call? token transfer amount tx-sender owner none))))
