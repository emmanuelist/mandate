;; The deterministic yield venue of mock-venue.clar, holding testnet's official
;; sBTC instead of the mock token, so M1's testnet run uses real testnet sBTC and
;; only the venue is a stand-in: Zest is not on testnet. It names a testnet
;; contract, so it deploys on testnet and on a testnet fork only, and is tested
;; there (tests/sbtc-testnet.fork.ts).
;; Deposit takes the asset from contract-caller and mints shares to the
;; recipient; redeem burns shares from contract-caller and pays the recipient.
;; Shares and assets are 1:1. `haircut-bps` makes deposit mint fewer shares than
;; convert-to-shares quotes. Testnet only: anyone can set the haircut.
(define-fungible-token mshare)
(define-data-var haircut-bps uint u0)

(define-constant ERR_MIN_OUT (err u201))

(define-public (set-haircut (bps uint))
  (begin (var-set haircut-bps bps) (ok true)))

(define-read-only (convert-to-shares (amount uint)) (ok amount))
(define-read-only (convert-to-assets (shares uint)) (ok shares))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance mshare who)))

(define-public (deposit (amount uint) (min-out uint) (recipient principal))
  (let ((payer contract-caller)
        (me (try! (as-contract? () tx-sender)))
        (shares (/ (* amount (- u10000 (var-get haircut-bps))) u10000)))
    (asserts! (>= shares min-out) ERR_MIN_OUT)
    (try! (contract-call? 'SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token transfer amount payer me none))
    (try! (ft-mint? mshare shares recipient))
    (ok shares)))

(define-public (redeem (shares uint) (min-out uint) (recipient principal))
  (let ((holder contract-caller))
    (asserts! (>= shares min-out) ERR_MIN_OUT)
    (try! (ft-burn? mshare shares holder))
    (try! (as-contract? ((with-ft 'SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token "*" shares))
      (try! (contract-call? 'SN3VMHXEN64ZZF71JQ5VESXDWTR301XTTXGF4J8F1.sbtc-token transfer shares tx-sender recipient none))))
    (ok shares)))
