function TrendChart({ data, emptyMessage = "No data yet" }) {
  if (!data.length) {
    return <p className="chart-empty muted">{emptyMessage}</p>
  }

  const max = Math.max(
    ...data.flatMap((d) => [d.income || 0, d.expense || 0]),
    1
  )

  return (
    <div className="trend-chart">
      <div className="trend-chart-bars">
        {data.map((month) => (
          <div key={month.key} className="trend-chart-group">
            <div className="trend-chart-pair">
              <div
                className="trend-bar income"
                style={{ height: `${((month.income || 0) / max) * 100}%` }}
                title={`Income: ${month.income || 0}`}
              />
              <div
                className="trend-bar expense"
                style={{ height: `${((month.expense || 0) / max) * 100}%` }}
                title={`Expense: ${month.expense || 0}`}
              />
            </div>
            <span className="trend-chart-label">{month.shortLabel}</span>
          </div>
        ))}
      </div>
      <div className="chart-legend trend-legend">
        <span className="chart-legend-item">
          <span className="chart-legend-swatch income" /> Income
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-swatch expense" /> Expenses
        </span>
      </div>
    </div>
  )
}

export default TrendChart
