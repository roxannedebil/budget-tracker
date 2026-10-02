/** Expense-like rows for totals, budget, and reports (fees are not transfer legs). */
export function isExpenseTransaction(t) {
  return t?.type === "expense" || t?.type === "fee"
}

export function isTransferLegForVolume(t) {
  return (
    t?.type === "transfer" ||
    t?.type === "transfer_out" ||
    t?.type === "transfer_in"
  )
}
