export function isAccountInUse(accountId, transactions) {
  return transactions.some(
    (t) =>
      t.from_account_id === accountId || t.to_account_id === accountId
  )
}
