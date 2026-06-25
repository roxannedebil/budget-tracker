function ChartCard({ title, subtitle, children, className = "" }) {
  return (
    <section className={`card chart-card recharts-card ${className}`.trim()}>
      <div className="chart-card-header">
        <h3 className="chart-card-title">{title}</h3>
        {subtitle && <p className="chart-card-subtitle">{subtitle}</p>}
      </div>
      <div className="chart-card-body">{children}</div>
    </section>
  )
}

export default ChartCard
