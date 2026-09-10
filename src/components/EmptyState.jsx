import Icon from "./icons/Icons"

function EmptyState({ icon, title = "No data", message }) {
  const iconNode = icon ?? <Icon name="inbox" size={32} />

  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        {iconNode}
      </span>
      <p className="empty-state-title">{title}</p>
      {message && <p className="empty-state-message muted">{message}</p>}
    </div>
  )
}

export default EmptyState
