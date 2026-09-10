import Icon from "../icons/Icons"
import { formatMoney } from "../../utils/transactionStats"

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
  const cards = [
    {
      label: "Expenses",
      icon: "expense",
      current: comparison.expenses.current,
      previous: comparison.expenses.previous,
      change: comparison.expenses.change,
      variant: "expense",
      invert: true,
    },
    {
      label: "Income",
      icon: "income",
      current: comparison.income.current,
      previous: comparison.income.previous,
      change: comparison.income.change,
      variant: "income",
    },
    {
      label: "Savings",
      icon: "wallet",
      current: comparison.savings.current,
      previous: comparison.savings.previous,
      change: comparison.savings.change,
      variant: "balance",
    },
  ]

  return (
    <section className="reports-section">
      <div className="reports-section-head">
        <h2 className="reports-section-title">Month over month</h2>
        <p className="reports-section-subtitle muted">
          This month compared to last month
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
            <span className="comparison-current">{formatMoney(card.current)}</span>
            <div className="comparison-meta">
              <span className="comparison-prev">
                Last month: {formatMoney(card.previous)}
              </span>
              <ChangeBadge change={card.change} invert={card.invert} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ComparisonCards
