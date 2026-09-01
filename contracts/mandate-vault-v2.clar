;; mandate-vault-v2 -- policy-complete candidate
;;
;; Defects found by the adversarial pass and fixed here:
;;   1. mandates keyed by (owner, agent)      -> no reverse-map hijack
;;   2. per-(owner,token) balance ledger      -> no commingling
;;   3. withdraw independent of any mandate   -> revocation cannot strand funds
;;   4. min-dy quoted on-chain via get-dy     -> the agent cannot pick its own price
;; Policy engine completed after the pressure test:
;;   5. rate limit over a burn-height window
;;   6. rolling daily notional cap
;;   7. cumulative slippage budget (the oracle-free stand-in for drawdown)

(use-trait sip-010 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)

(define-constant BF 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2)
(define-constant BPS u10000)
(define-constant DAY u144)          ;; ~1 day of Bitcoin blocks

(define-constant ERR_NO_MANDATE  (err u100))
(define-constant ERR_TOO_LARGE   (err u102))
(define-constant ERR_EXPIRED     (err u103))
(define-constant ERR_BALANCE     (err u105))
(define-constant ERR_ASSET       (err u106))
(define-constant ERR_VENUE       (err u107))
(define-constant ERR_SLIPPAGE    (err u108))
(define-constant ERR_QUOTE       (err u109))
(define-constant ERR_RATE        (err u110))
(define-constant ERR_DAILY       (err u111))
(define-constant ERR_LOSS_BUDGET (err u112))

(define-map mandates
  { owner: principal, agent: principal }
  { max-notional: uint, expires: uint, max-slip-bps: uint,
    max-trades-per-window: uint, window-len: uint,
    max-daily-notional: uint, max-cum-slip-bps: uint })

(define-map counters
  { owner: principal, agent: principal }
  { window-start: uint, window-count: uint,
    day-start: uint, day-notional: uint, cum-slip-bps: uint })

(define-map balances { owner: principal, token: principal } { amount: uint })
;; FIX 6: allowlists are per-owner. Global maps let any stranger write a policy
;; control that governed every mandate in the contract.
(define-map allowed-asset { owner: principal, token: principal } { ok: bool })
(define-map allowed-venue { owner: principal, pool: principal }  { ok: bool })

(define-read-only (balance-of (owner principal) (token principal))
  (default-to u0 (get amount (map-get? balances { owner: owner, token: token }))))

(define-read-only (counters-of (owner principal) (agent principal))
  (default-to { window-start: u0, window-count: u0, day-start: u0, day-notional: u0, cum-slip-bps: u0 }
    (map-get? counters { owner: owner, agent: agent })))

(define-read-only (asset-ok (o principal) (t principal))
  (default-to false (get ok (map-get? allowed-asset { owner: o, token: t }))))
(define-read-only (venue-ok (o principal) (p principal))
  (default-to false (get ok (map-get? allowed-venue { owner: o, pool: p }))))

(define-private (credit (owner principal) (token principal) (amt uint))
  (map-set balances { owner: owner, token: token }
           { amount: (+ (balance-of owner token) amt) }))

;; an owner may only ever edit their own allowlist
(define-public (allow-asset (token principal))
  (begin (map-set allowed-asset { owner: tx-sender, token: token } { ok: true }) (ok true)))
(define-public (allow-venue (pool principal))
  (begin (map-set allowed-venue { owner: tx-sender, pool: pool } { ok: true }) (ok true)))
(define-public (disallow-asset (token principal))
  (begin (map-delete allowed-asset { owner: tx-sender, token: token }) (ok true)))
(define-public (disallow-venue (pool principal))
  (begin (map-delete allowed-venue { owner: tx-sender, pool: pool }) (ok true)))

(define-public (deposit (token <sip-010>) (amount uint))
  (let ((owner tx-sender))
    (asserts! (asset-ok owner (contract-of token)) ERR_ASSET)
    (try! (contract-call? token transfer amount owner (try! (as-contract? () tx-sender)) none))
    (credit owner (contract-of token) amount)
    (ok true)))

(define-public (grant
    (agent principal) (max-notional uint) (expires uint) (max-slip-bps uint)
    (max-trades-per-window uint) (window-len uint)
    (max-daily-notional uint) (max-cum-slip-bps uint))
  (begin
    (map-set mandates { owner: tx-sender, agent: agent }
      { max-notional: max-notional, expires: expires, max-slip-bps: max-slip-bps,
        max-trades-per-window: max-trades-per-window, window-len: window-len,
        max-daily-notional: max-daily-notional, max-cum-slip-bps: max-cum-slip-bps })
    (map-set counters { owner: tx-sender, agent: agent }
      { window-start: burn-block-height, window-count: u0,
        day-start: burn-block-height, day-notional: u0, cum-slip-bps: u0 })
    (ok true)))

(define-public (revoke (agent principal))
  (begin (map-delete mandates { owner: tx-sender, agent: agent }) (ok true)))

;; withdrawal depends only on the ledger, never on a mandate
(define-public (withdraw (token <sip-010>) (amount uint))
  (let ((owner tx-sender) (tok (contract-of token))
        (bal (balance-of tx-sender (contract-of token))))
    (asserts! (>= bal amount) ERR_BALANCE)
    (map-set balances { owner: owner, token: tok } { amount: (- bal amount) })
    (as-contract? ((with-ft (contract-of token) "*" amount))
      (try! (contract-call? token transfer amount tx-sender owner none)))))

(define-public (execute
    (owner principal) (pool <xyk-pool>)
    (x-token <sip-010>) (y-token <sip-010>) (x-amount uint))
  (let ((m  (unwrap! (map-get? mandates { owner: owner, agent: tx-sender }) ERR_NO_MANDATE))
        (c  (counters-of owner tx-sender))
        (xt (contract-of x-token))
        (yt (contract-of y-token))
        (bal (balance-of owner (contract-of x-token)))
        (h  burn-block-height))

    ;; identity first, then policy, then state
    (asserts! (asset-ok owner xt) ERR_ASSET)
    (asserts! (asset-ok owner yt) ERR_ASSET)
    (asserts! (venue-ok owner (contract-of pool)) ERR_VENUE)
    (asserts! (<= x-amount (get max-notional m)) ERR_TOO_LARGE)
    (asserts! (< h (get expires m)) ERR_EXPIRED)

    (let (
        ;; rate limit -- window rolls forward on its own
        (win-live  (< h (+ (get window-start c) (get window-len m))))
        (win-start (if win-live (get window-start c) h))
        (win-count (if win-live (get window-count c) u0))
        ;; rolling daily notional
        (day-live  (< h (+ (get day-start c) DAY)))
        (day-start (if day-live (get day-start c) h))
        (day-notl  (if day-live (get day-notional c) u0)))

      ;; policy exhaustion is an authority question, so it is answered
      ;; before the state question of whether the funds are there
      (asserts! (< win-count (get max-trades-per-window m)) ERR_RATE)
      (asserts! (<= (+ day-notl x-amount) (get max-daily-notional m)) ERR_DAILY)
      (asserts! (>= bal x-amount) ERR_BALANCE)

      (let ((quoted (unwrap! (contract-call? BF get-dy pool x-token y-token x-amount) ERR_QUOTE)))
        (asserts! (> quoted u0) ERR_QUOTE)
        (let ((floor (/ (* quoted (- BPS (get max-slip-bps m))) BPS)))
          (map-set balances { owner: owner, token: xt } { amount: (- bal x-amount) })
          ;; Clarity 4 caps the vault's own outflow, so a compromised venue
          ;; still cannot take more than the mandate authorised
          (let ((got (try! (as-contract? ((with-ft (contract-of x-token) "*" x-amount))
                             (try! (contract-call? BF swap-x-for-y
                                     pool x-token y-token x-amount floor))))))
            (asserts! (>= got floor) ERR_SLIPPAGE)
            (let ((slip (if (>= got quoted) u0 (/ (* (- quoted got) BPS) quoted)))
                  (cum  (get cum-slip-bps c)))
              ;; cumulative execution bleed -- oracle-free stand-in for drawdown
              (asserts! (<= (+ cum slip) (get max-cum-slip-bps m)) ERR_LOSS_BUDGET)
              (map-set counters { owner: owner, agent: tx-sender }
                { window-start: win-start, window-count: (+ win-count u1),
                  day-start: day-start, day-notional: (+ day-notl x-amount),
                  cum-slip-bps: (+ cum slip) })
              (credit owner yt got)
              (ok got))))))))
