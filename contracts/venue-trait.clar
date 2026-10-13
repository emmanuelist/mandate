;; The interface the vault allocates through: the tokenized-vault shape.
;; Zest's v0 vaults already have these four functions with these signatures,
;; so the vault can call them through this trait with no adapter in between.
(define-trait venue
  (
    (convert-to-shares (uint) (response uint uint))
    (convert-to-assets (uint) (response uint uint))
    (deposit (uint uint principal) (response uint uint))
    (redeem (uint uint principal) (response uint uint))
  ))
