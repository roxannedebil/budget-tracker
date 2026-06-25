function InsightsPanel({ insights }) {
  if (!insights.length) {
    return null
  }

  return (
    <section className="reports-section">
      <div className="reports-section-head">
        <h2 className="reports-section-title">Financial insights</h2>
        <p className="reports-section-subtitle muted">
          Auto-generated from your filtered data
        </p>
      </div>
      <div className="card insights-card module-card">
        <ul className="insights-list">
          {insights.map((item) => (
            <li key={item.title} className="insight-item">
              <span className="insight-icon" aria-hidden="true">
                {item.icon}
              </span>
              <div className="insight-body">
                <span className="insight-title">{item.title}</span>
                <span className="insight-value">{item.value}</span>
                {item.detail && (
                  <span className="insight-detail">{item.detail}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default InsightsPanel
