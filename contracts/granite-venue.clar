;; granite-venue -- Mandate's venue trait over Granite's USDCx lending pool
;;
;; Granite's liquidity-provider-v1 takes USDCx from its caller and mints LP tokens
;; to a recipient, but burns LP tokens from its caller on redeem. So this adapter
;; supplies USDCx to Granite in its own name, holds the LP tokens, and mints its
;; own shares to whoever deposited, one per LP token received. Redeeming burns the
;; caller's shares, redeems as many LP tokens, and pays out the USDCx that arrived.
;; Granite takes no minimum output and returns only a bool, so the adapter measures
;; what each call delivered and enforces the minimum itself (D-020).
;;
;; Quotes use Granite's own math at the current pool parameters. Granite accrues
;; interest when a call starts, so a deposit can mint slightly fewer shares than a
;; quote taken just before it. Granite's operators can pause deposits or
;; withdrawals, and a redeem needs unborrowed liquidity in the pool.

(define-fungible-token gshare)

(define-constant ERR_MIN_OUT (err u301))

(define-read-only (get-balance (who principal)) (ok (ft-get-balance gshare who)))

(define-read-only (convert-to-shares (amount uint))
  (ok (contract-call? 'SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.math-v1 convert-to-shares
        (contract-call? 'SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.state-v1 get-lp-params) amount false)))

(define-read-only (convert-to-assets (shares uint))
  (ok (contract-call? 'SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.math-v1 convert-to-assets
        (contract-call? 'SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.state-v1 get-lp-params) shares false)))

(define-private (lp-of (who principal))
  (unwrap-panic (contract-call? 'SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.state-v1 get-balance who)))

(define-private (usdcx-of (who principal))
  (unwrap-panic (contract-call? 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx get-balance who)))

(define-public (deposit (amount uint) (min-out uint) (recipient principal))
  (let ((payer contract-caller)
        (me (try! (as-contract? () tx-sender)))
        (lp-before (lp-of me)))
    ;; take the USDCx from the caller, then supply it to Granite in the adapter's name
    (try! (contract-call? 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx transfer amount payer me none))
    (try! (as-contract? ((with-ft 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx "*" amount))
      (try! (contract-call? 'SPSX722NK9V3A8D3CVQT0CDY4EBQ3E9FSDDE61FT.liquidity-provider-v1 deposit amount tx-sender))))
    ;; mint the shares for the LP tokens that actually arrived
    (let ((lp-after (lp-of me))
          (got (if (> lp-after lp-before) (- lp-after lp-before) u0)))
      (asserts! (>= got min-out) ERR_MIN_OUT)
      (try! (ft-mint? gshare got recipient))
      (ok got))))

(define-public (redeem (shares uint) (min-out uint) (recipient principal))
  (let ((holder contract-caller)
        (me (try! (as-contract? () tx-sender)))
        (usd-before (usdcx-of me)))
    (try! (ft-burn? gshare shares holder))
    ;; redeem as many LP tokens from Granite, in the adapter's name, paid to the adapter
    (try! (as-contract? ((with-ft 'SP3M2BYF7RGF8WKW5FVDNJ6WR8D7AR9BHDXAKPXZE.state-v1 "*" shares))
      (try! (contract-call? 'SPSX722NK9V3A8D3CVQT0CDY4EBQ3E9FSDDE61FT.liquidity-provider-v1 redeem shares tx-sender))))
    ;; pay out the USDCx that actually arrived
    (let ((usd-after (usdcx-of me))
          (got (if (> usd-after usd-before) (- usd-after usd-before) u0)))
      (asserts! (>= got min-out) ERR_MIN_OUT)
      (try! (as-contract? ((with-ft 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx "*" got))
        (try! (contract-call? 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx transfer got tx-sender recipient none))))
      (ok got))))
