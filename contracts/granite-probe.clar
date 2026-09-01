;; Can a mandate vault post sBTC collateral to Granite?
;; Granite binds contract-caller as the user and has no is-standard guard anywhere.
;; Note: Granite uses the CANONICAL sip-010 trait, not Bitflow's -- venue adapters
;; cannot share a single trait type.
(use-trait bf-010 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait gt-010 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)
(define-constant GRANITE 'SPSX722NK9V3A8D3CVQT0CDY4EBQ3E9FSDDE61FT.borrower-v1)

(define-public (fund (token <bf-010>) (amount uint))
  (contract-call? token transfer amount tx-sender (as-contract tx-sender) none))

(define-public (post-collateral (collateral <gt-010>) (amount uint))
  (as-contract (contract-call? GRANITE add-collateral collateral amount none)))
