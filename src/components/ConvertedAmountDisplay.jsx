import { formatCurrency } from "../utils/currency"

/** Primary total plus native lines when FX rate is unavailable. */
function ConvertedAmountDisplay({
  primary,
  total,
  missingRates = [],
  className = "",
  valueClassName = "dashboard-hero-stat-value",
  missingClassName = "fx-no-rate",
}) {
  const hasTotal = Number.isFinite(total)
  const missing = missingRates.filter((m) => m.amount != null && m.amount !== 0)

  return (
    <span className={`converted-amount-display ${className}`}>
      {hasTotal ? (
        <span className={valueClassName}>{formatCurrency(total, primary)}</span>
      ) : (
        <span className={valueClassName}>—</span>
      )}
      {missing.map((m) => (
        <span key={m.currency} className={`${valueClassName} ${missingClassName}`}>
          {formatCurrency(m.amount, m.currency)}{" "}
          <span
            className="fx-no-rate-label"
            title="No exchange rate is available yet for this currency."
          >
            (no rate)
          </span>
        </span>
      ))}
    </span>
  )
}

export default ConvertedAmountDisplay
