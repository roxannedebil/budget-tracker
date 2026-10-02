import { formatDisplayDate } from "./formatDate"
import { formatTransactionAmount } from "./currency"
import { getTypeLabel } from "./transactionDisplay"

export function getTransactionDeleteSummary(transaction) {
  if (!transaction) return ""

  const type = getTypeLabel(transaction)
  const amount = formatTransactionAmount(transaction, { signed: true })
  const date = formatDisplayDate(transaction.date)
  const category = transaction.category || "—"
  const notes = transaction.notes?.trim()

  let line = `${type} · ${amount} · ${category} · ${date}`
  if (notes) line += ` · ${notes}`
  return line
}
