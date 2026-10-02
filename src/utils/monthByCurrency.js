import { formatCurrency, getTransactionCurrency, getTransactionMajorAbs } from "./currency"
import { sumBalancesByCurrency } from "./netWorth"
import { isExpenseTransaction } from "./transactionTypes"

export function summarizeByCurrency(transactions, typeFilter = null) {
  const buckets = {}

  for (const t of transactions) {
    if (typeFilter === "income" && t.type !== "income") continue
    if (typeFilter === "expense" && !isExpenseTransaction(t)) continue
    if (
      typeFilter &&
      typeFilter !== "income" &&
      typeFilter !== "expense" &&
      t.type !== typeFilter
    ) {
      continue
    }

    const cur = getTransactionCurrency(t)
    if (!buckets[cur]) {
      buckets[cur] = { currency: cur, income: 0, expense: 0 }
    }
    const major = getTransactionMajorAbs(t)
    if (t.type === "income") buckets[cur].income += major
    else if (t.type === "expense" || t.type === "fee") buckets[cur].expense += major
  }

  return Object.values(buckets)
    .map((b) => ({
      ...b,
      net: b.income - b.expense,
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export function summarizeMonthTotals(transactions) {
  return summarizeByCurrency(transactions)
}

export function summarizeTransfersByCurrency(transactions) {
  const buckets = {}

  for (const t of transactions) {
    if (t.type !== "transfer" && t.type !== "transfer_out") continue
    const cur = getTransactionCurrency(t)
    buckets[cur] = (buckets[cur] || 0) + getTransactionMajorAbs(t)
  }

  return Object.entries(buckets)
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

/** Combined account balances, one total per currency (not merged across codes). */
export function summarizeBalancesByCurrency(accounts, transactions) {
  const buckets = sumBalancesByCurrency(accounts, transactions)
  return Object.entries(buckets)
    .map(([currency, total]) => ({ currency: currency.toUpperCase(), total }))
    .filter((row) => row.total !== 0)
    .sort((a, b) => a.currency.localeCompare(b.currency))
}

export function formatCurrencyList(items, pick) {
  const parts = items
    .map((row) => {
      const n = pick(row)
      if (!n) return null
      return formatCurrency(n, row.currency)
    })
    .filter(Boolean)

  return parts.length ? parts.join(" · ") : null
}
