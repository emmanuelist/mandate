;; Can a Clarity contract be a maker on Jing's live sBTC/STX market?
;; Run against markets-sbtc-stx-jing-v6-2 forked at block 9036500: after
;; initialize (9036427) and before the first deposit (9036611). The book is
;; empty, so the market needs no Pyth price update and the test isolates one
;; question: does it accept a contract as the depositor, and refund it?
(use-trait ft 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(define-constant JING 'SPV9K21TBFAK4KNRJXF5DFP8N7W46G4V9RCJDC22.markets-sbtc-stx-jing-v6-2)

;; post sBTC as a maker, with this contract as the depositor
(define-public (make (token <ft>) (amount uint) (limit uint))
  (as-contract? ((with-ft (contract-of token) "sbtc-token" amount))
    (try! (contract-call? JING deposit-token-x amount limit none 0x token "sbtc-token"))))

;; cancel the order and take the sBTC back
(define-public (cancel (token <ft>))
  (as-contract? ()
    (try! (contract-call? JING cancel-token-x-deposit token "sbtc-token"))))
