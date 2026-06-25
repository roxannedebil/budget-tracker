import { formatDisplayDate } from "./formatDate"
import { formatMoney } from "./transactionStats"
import { getTypeLabel } from "./transactionDisplay"

export function getTransactionDeleteSummary(transaction) {
  if (!transaction) return ""

  const type = getTypeLabel(transaction)
  const amount = formatMoney(transaction.amount)
  const date = formatDisplayDate(transaction.date)
  const category = transaction.category || "—"
  const notes = transaction.notes?.trim()

  let line = `${type} · ${amount} · ${category} · ${date}`
  if (notes) line += ` · ${notes}`
  return line
}
