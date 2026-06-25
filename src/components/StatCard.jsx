function StatCard({ label, value, variant, icon, hint }) {
  return (
    <div className={`stat-card stat-card-enhanced kpi-card ${variant || ""}`}>
      {icon && (
        <div className="kpi-card-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <div className="kpi-card-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {hint && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  )
}

export default StatCard
