;; mandate-vault-v3 -- the delegate allocates through a venue trait
;;
;; Carries every fix and limit from v2 (its header, and docs/EVIDENCE.md E-007).
;; What changes: the delegate no longer swaps on a DEX. It allocates the owner's
;; idle assets into a yield venue and unwinds them, through the venue trait in
;; venue-trait.clar. Zest's v0 vaults satisfy that trait as deployed, so the
;; vault is Zest's contract-caller: it pays for itself and holds its own shares,
;; with no adapter in between.
;;
;; Positions remember their asset, so the owner can always bring one home:
;; after revoking, after expiry, or after disallowing the venue. Unwinding is
;; de-risking, so the delegate's unwind skips the per-move and daily caps but
;; still counts against the rate window and the slippage budget.
;;
;; Measure, don't trust: every venue call is bracketed by balance reads. The
;; vault's books follow what it actually holds, and a venue that reports more
;; than it delivered, takes other than the move, or burns other than asked is
;; refused. The per-owner allowlist stays the trust anchor, since a venue
;; answers for its own share ledger.

(use-trait ft .sip-010-trait.sip-010-trait)
(use-trait venue .venue-trait.venue)

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
(define-constant ERR_POSITION    (err u113))
(define-constant ERR_MISREPORT   (err u114))
(define-constant ERR_AGENT       (err u115))
(define-constant ERR_PARAMS      (err u116))

(define-map mandates
  { owner: principal, agent: principal }
  { max-notional: uint, expires: uint, max-slip-bps: uint,
    max-trades-per-window: uint, window-len: uint,
    max-daily-notional: uint, max-cum-slip-bps: uint })

(define-map counters
  { owner: principal, agent: principal }
  { window-start: uint, window-count: uint,
    day-start: uint, day-notional: uint, cum-slip-bps: uint })

;; idle assets held for each owner
(define-map balances { owner: principal, token: principal } { amount: uint })
;; venue shares held for each owner, and the asset they unwind to
(define-map positions { owner: principal, venue: principal } { shares: uint, asset: principal })
;; per-owner allowlists (v2's fix): assets, and venues with the asset each takes
(define-map allowed-asset { owner: principal, token: principal } { ok: bool })
(define-map allowed-venue { owner: principal, venue: principal } { asset: principal })

(define-read-only (balance-of (owner principal) (token principal))
  (default-to u0 (get amount (map-get? balances { owner: owner, token: token }))))

(define-read-only (shares-of (owner principal) (v principal))
  (default-to u0 (get shares (map-get? positions { owner: owner, venue: v }))))

(define-read-only (position-of (owner principal) (v principal))
  (map-get? positions { owner: owner, venue: v }))

(define-read-only (counters-of (owner principal) (agent principal))
  (default-to { window-start: u0, window-count: u0, day-start: u0, day-notional: u0, cum-slip-bps: u0 }
    (map-get? counters { owner: owner, agent: agent })))

(define-read-only (asset-ok (o principal) (t principal))
  (default-to false (get ok (map-get? allowed-asset { owner: o, token: t }))))

(define-read-only (venue-asset (o principal) (v principal))
  (get asset (map-get? allowed-venue { owner: o, venue: v })))

(define-private (credit (owner principal) (token principal) (amt uint))
  (map-set balances { owner: owner, token: token }
           { amount: (+ (balance-of owner token) amt) }))

;; an owner may only ever edit their own allowlists
(define-public (allow-asset (token principal))
  (begin (map-set allowed-asset { owner: tx-sender, token: token } { ok: true }) (ok true)))
(define-public (disallow-asset (token principal))
  (begin (map-delete allowed-asset { owner: tx-sender, token: token }) (ok true)))
(define-public (allow-venue (v principal) (asset principal))
  (begin (map-set allowed-venue { owner: tx-sender, venue: v } { asset: asset }) (ok true)))
(define-public (disallow-venue (v principal))
  (begin (map-delete allowed-venue { owner: tx-sender, venue: v }) (ok true)))

(define-public (deposit (token <ft>) (amount uint))
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
    ;; the vault can't be its own delegate: a venue calling back mid-call runs
    ;; as the vault, so a mandate held by the vault would let that venue act
    (asserts! (not (is-eq agent (try! (as-contract? () tx-sender)))) ERR_AGENT)
    ;; refuse parameters that would switch a limit off (a zero-length window
    ;; restarts on every call) or abort later (a floor computed below zero)
    (asserts! (> window-len u0) ERR_PARAMS)
    (asserts! (<= max-slip-bps BPS) ERR_PARAMS)
    (asserts! (<= max-cum-slip-bps BPS) ERR_PARAMS)
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
(define-public (withdraw (token <ft>) (amount uint))
  (let ((owner tx-sender) (tok (contract-of token))
        (bal (balance-of tx-sender (contract-of token))))
    (asserts! (>= bal amount) ERR_BALANCE)
    (map-set balances { owner: owner, token: tok } { amount: (- bal amount) })
    (as-contract? ((with-ft (contract-of token) "*" amount))
      (try! (contract-call? token transfer amount tx-sender owner none)))))

;; the delegate moves idle assets into an allowlisted venue
(define-public (allocate (owner principal) (v <venue>) (asset <ft>) (amount uint))
  (let ((m   (unwrap! (map-get? mandates { owner: owner, agent: tx-sender }) ERR_NO_MANDATE))
        (c   (counters-of owner tx-sender))
        (vn  (contract-of v))
        (at  (contract-of asset))
        (bal (balance-of owner at))
        (h   burn-block-height))

    ;; identity first, then policy, then state
    (asserts! (asset-ok owner at) ERR_ASSET)
    (asserts! (is-eq (venue-asset owner vn) (some at)) ERR_VENUE)
    ;; a position keeps the asset it was opened with
    (asserts! (match (position-of owner vn) p (is-eq (get asset p) at) true) ERR_VENUE)
    (asserts! (<= amount (get max-notional m)) ERR_TOO_LARGE)
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
      (asserts! (<= (+ day-notl amount) (get max-daily-notional m)) ERR_DAILY)
      (asserts! (>= bal amount) ERR_BALANCE)

      (let ((quoted (unwrap! (contract-call? v convert-to-shares amount) ERR_QUOTE))
            (me     (try! (as-contract? () tx-sender))))
        (asserts! (> quoted u0) ERR_QUOTE)
        (let ((floor         (/ (* quoted (- BPS (get max-slip-bps m))) BPS))
              (asset-before  (unwrap! (contract-call? asset get-balance me) ERR_QUOTE))
              (shares-before (unwrap! (contract-call? v get-balance me) ERR_QUOTE)))
          (map-set balances { owner: owner, token: at } { amount: (- bal amount) })
          ;; the outflow is capped at the move, so a venue cannot take more
          (let ((reported (try! (as-contract? ((with-ft at "*" amount))
                                  (try! (contract-call? v deposit amount floor me)))))
                (asset-after  (unwrap! (contract-call? asset get-balance me) ERR_QUOTE))
                (shares-after (unwrap! (contract-call? v get-balance me) ERR_QUOTE))
                (spent (if (>= asset-before asset-after) (- asset-before asset-after) u0))
                (got   (if (> shares-after shares-before) (- shares-after shares-before) u0)))
            ;; measure, don't trust: exactly the move left, and the shares arrived
            (asserts! (is-eq spent amount) ERR_MISREPORT)
            (asserts! (<= reported got) ERR_MISREPORT)
            (asserts! (>= got floor) ERR_SLIPPAGE)
            (let ((slip (if (>= got quoted) u0 (/ (* (- quoted got) BPS) quoted)))
                  (cum  (get cum-slip-bps c)))
              ;; cumulative execution bleed -- oracle-free stand-in for drawdown
              (asserts! (<= (+ cum slip) (get max-cum-slip-bps m)) ERR_LOSS_BUDGET)
              (map-set counters { owner: owner, agent: tx-sender }
                { window-start: win-start, window-count: (+ win-count u1),
                  day-start: day-start, day-notional: (+ day-notl amount),
                  cum-slip-bps: (+ cum slip) })
              (map-set positions { owner: owner, venue: vn }
                { shares: (+ (shares-of owner vn) got), asset: at })
              (ok got))))))))

;; debit the position, redeem under a cap on the vault's shares, credit what
;; actually arrived
(define-private (exit-position (owner principal) (v <venue>) (asset <ft>) (shares uint) (min-out uint))
  (let ((vn   (contract-of v))
        (p    (unwrap! (position-of owner vn) ERR_POSITION))
        (have (get shares p))
        (me   (try! (as-contract? () tx-sender))))
    (asserts! (is-eq (contract-of asset) (get asset p)) ERR_ASSET)
    (asserts! (and (> shares u0) (<= shares have)) ERR_POSITION)
    (if (is-eq shares have)
        (map-delete positions { owner: owner, venue: vn })
        (map-set positions { owner: owner, venue: vn } { shares: (- have shares), asset: (get asset p) }))
    (let ((shares-before (unwrap! (contract-call? v get-balance me) ERR_QUOTE))
          (asset-before  (unwrap! (contract-call? asset get-balance me) ERR_QUOTE))
          (reported (try! (as-contract? ((with-ft vn "*" shares))
                            (try! (contract-call? v redeem shares min-out me)))))
          (shares-after (unwrap! (contract-call? v get-balance me) ERR_QUOTE))
          (asset-after  (unwrap! (contract-call? asset get-balance me) ERR_QUOTE))
          (got (if (> asset-after asset-before) (- asset-after asset-before) u0)))
      ;; measure, don't trust: exactly the shares asked were burned, and the
      ;; assets the venue reported arrived
      (asserts! (and (>= shares-before shares-after)
                     (is-eq (- shares-before shares-after) shares)) ERR_MISREPORT)
      (asserts! (<= reported got) ERR_MISREPORT)
      (asserts! (>= got min-out) ERR_SLIPPAGE)
      (credit owner (get asset p) got)
      (ok got))))

;; the delegate brings a position back to idle, inside the mandate
(define-public (unwind (owner principal) (v <venue>) (asset <ft>) (shares uint))
  (let ((m (unwrap! (map-get? mandates { owner: owner, agent: tx-sender }) ERR_NO_MANDATE))
        (c (counters-of owner tx-sender))
        (h burn-block-height))
    (asserts! (< h (get expires m)) ERR_EXPIRED)
    (let ((win-live  (< h (+ (get window-start c) (get window-len m))))
          (win-start (if win-live (get window-start c) h))
          (win-count (if win-live (get window-count c) u0)))
      (asserts! (< win-count (get max-trades-per-window m)) ERR_RATE)
      (asserts! (<= shares (shares-of owner (contract-of v))) ERR_POSITION)
      (let ((quoted (unwrap! (contract-call? v convert-to-assets shares) ERR_QUOTE)))
        (asserts! (> quoted u0) ERR_QUOTE)
        (let ((got (try! (exit-position owner v asset shares
                           (/ (* quoted (- BPS (get max-slip-bps m))) BPS))))
              (slip (if (>= got quoted) u0 (/ (* (- quoted got) BPS) quoted)))
              (cum  (get cum-slip-bps c)))
          (asserts! (<= (+ cum slip) (get max-cum-slip-bps m)) ERR_LOSS_BUDGET)
          (map-set counters { owner: owner, agent: tx-sender }
            (merge c { window-start: win-start, window-count: (+ win-count u1),
                       cum-slip-bps: (+ cum slip) }))
          (ok got))))))

;; the owner can always bring a position home: no mandate, no rate limit
(define-public (owner-unwind (v <venue>) (asset <ft>) (shares uint) (min-out uint))
  (exit-position tx-sender v asset shares min-out))
