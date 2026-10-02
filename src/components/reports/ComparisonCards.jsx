import Icon from "../icons/Icons"
import CurrencyTotalsLines from "../CurrencyTotalsLines"

function ChangeBadge({ change, invert = false }) {
  const isUp = change >= 0
  const positive = invert ? !isUp : isUp
  const sign = isUp ? "+" : ""
  return (
    <span className={`change-badge ${positive ? "up" : "down"}`}>
      {sign}
      {change.toFixed(1)}%
    </span>
  )
}

function ComparisonCards({ comparison }) {
  const currentRows = comparison.byCurrency?.current ?? []
  const previousRows = comparison.byCurrency?.previous ?? []
  const multiCurrency = currentRows.filter((r) => r.income || r.expense || r.net).length > 1

  const cards = [
    {
      label: "Expenses",
      icon: "expense",
      pick: (r) => r.expense,
      change: comparison.expenses.change,
      variant: "expense",
      invert: true,
    },
    {
      label: "Income",
      icon: "income",
      pick: (r) => r.income,
      change: comparison.income.change,
      variant: "income",
    },
    {
      label: "Savings",
      icon: "wallet",
      pick: (r) => r.net,
      change: comparison.savings.change,
      variant: "balance",
    },
  ]

  return (
    <section className="reports-section">
      <div className="reports-section-head">
        <h2 className="reports-section-title">Month over month</h2>
        <p className="reports-section-subtitle muted">
          This month compared to last month · per currency
        </p>
      </div>
      <div className="comparison-grid">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`card comparison-card module-card ${card.variant}`}
          >
            <div className="comparison-card-top">
              <span className="comparison-icon" aria-hidden="true">
                <Icon name={card.icon} size={18} />
              </span>
              <span className="comparison-label">{card.label}</span>
            </div>
            <span className="comparison-current">
              <CurrencyTotalsLines rows={currentRows} pick={card.pick} stacked />
            </span>
            <div className="comparison-meta">
              <span className="comparison-prev">
                Last month:{" "}
                <CurrencyTotalsLines rows={previousRows} pick={card.pick} stacked />
              </span>
              {!multiCurrency && (
                <ChangeBadge change={card.change} invert={card.invert} />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ComparisonCards
