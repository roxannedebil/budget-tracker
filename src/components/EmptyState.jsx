function EmptyState({ icon = "📭", title = "No data", message }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state-title">{title}</p>
      {message && <p className="empty-state-message muted">{message}</p>}
    </div>
  )
}

export default EmptyState
