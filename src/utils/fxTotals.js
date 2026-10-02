import { convertMajor } from "../services/rates/ratesService"
import { getTransactionCurrency, getTransactionMajorAbs } from "./currency"

/**
 * Sum magnitudes in primary using live rates.
 * Amounts without a rate are excluded from the total and listed separately.
 */
export function sumMajorsInPrimary(entries, primary, ratesTable) {
  const base = (primary || "PHP").toUpperCase()
  let total = 0
  const missingRates = []

  for (const { currency, amount } of entries) {
    const cur = (currency || "PHP").toUpperCase()
    const major = Number(amount)
    if (!Number.isFinite(major) || major === 0) continue

    if (cur === base) {
      total += major
      continue
    }

    const converted = convertMajor(major, cur, base, ratesTable)
    if (Number.isFinite(converted)) {
      total += converted
    } else {
      missingRates.push({ currency: cur, amount: major })
    }
  }

  return { total, missingRates }
}

export function sumTransactionsInPrimary(transactions, primary, ratesTable, { types } = {}) {
  const allowed = types ? new Set(types) : null
  const entries = []

  for (const t of transactions || []) {
    if (allowed && !allowed.has(t.type)) continue
    entries.push({
      currency: getTransactionCurrency(t),
      amount: getTransactionMajorAbs(t),
    })
  }

  return sumMajorsInPrimary(entries, primary, ratesTable)
}

export function netWorthInPrimaryDetailed(totalsByCurrency, primary, ratesTable) {
  const entries = Object.entries(totalsByCurrency || {}).map(([currency, amount]) => ({
    currency,
    amount,
  }))
  return sumMajorsInPrimary(entries, primary, ratesTable)
}

export function summarizeMonthInPrimary(transactions, primary, ratesTable) {
  const income = sumTransactionsInPrimary(transactions, primary, ratesTable, {
    types: ["income"],
  })
  const expense = sumTransactionsInPrimary(transactions, primary, ratesTable, {
    types: ["expense"],
  })
  const missingMap = new Map()
  for (const m of [...income.missingRates, ...expense.missingRates]) {
    missingMap.set(m.currency, (missingMap.get(m.currency) || 0) + m.amount)
  }
  const missingRates = [...missingMap.entries()].map(([currency, amount]) => ({
    currency,
    amount,
  }))

  return {
    income: income.total,
    expense: expense.total,
    net: income.total - expense.total,
    missingRates,
  }
}
