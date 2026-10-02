import { convertMajor } from "../services/rates/ratesService"
import { getTransactionCurrency, getTransactionMajorAbs } from "./currency"
import { isExpenseTransaction } from "./transactionTypes"

/** Convert one transaction's magnitude to the user's primary currency (live rates). */
export function transactionMajorInPrimary(t, primary, ratesTable) {
  const cur = getTransactionCurrency(t)
  const major = getTransactionMajorAbs(t)
  const base = (primary || "PHP").toUpperCase()

  if (cur === base) return major
  if (!ratesTable?.rates) return NaN

  const converted = convertMajor(major, cur, base, ratesTable)
  return Number.isFinite(converted) ? converted : NaN
}

export function getIncomeInPrimary(transactions, primary, ratesTable) {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + transactionMajorInPrimary(t, primary, ratesTable), 0)
}

export function getExpensesInPrimary(transactions, primary, ratesTable) {
  return transactions
    .filter((t) => isExpenseTransaction(t))
    .reduce((sum, t) => sum + transactionMajorInPrimary(t, primary, ratesTable), 0)
}

export function getBalanceInPrimary(transactions, primary, ratesTable) {
  return (
    getIncomeInPrimary(transactions, primary, ratesTable) -
    getExpensesInPrimary(transactions, primary, ratesTable)
  )
}
