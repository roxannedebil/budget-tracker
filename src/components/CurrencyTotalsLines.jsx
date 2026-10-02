import { formatCurrency } from "../utils/currency"
import { useCurrency } from "../context/CurrencyContext"

/** One or more amounts, each with its own currency (never merged into one sum). */
function CurrencyTotalsLines({
  rows,
  pick,
  className = "",
  emptyCurrency,
  stacked = false,
  hideZero = true,
}) {
  const { primary } = useCurrency()
  const fallback = (emptyCurrency || primary || "PHP").toUpperCase()

  const parts = (rows || [])
    .map((row) => {
      const value = pick(row)
      if (hideZero && (value == null || value === 0)) return null
      const code = (row.currency || fallback).toUpperCase()
      return (
        <span key={code} className={`currency-total-line ${className}`.trim()}>
          {formatCurrency(value ?? 0, code)}
        </span>
      )
    })
    .filter(Boolean)

  if (parts.length === 0) {
    return (
      <span className={`currency-total-line ${className}`.trim()}>
        {formatCurrency(0, fallback)}
      </span>
    )
  }

  return (
    <span
      className={`currency-totals-wrap${stacked ? " currency-totals-stack" : ""}`}
    >
      {parts}
    </span>
  )
}

export default CurrencyTotalsLines
