import ThemeToggle from "./ThemeToggle"
import Icon from "./icons/Icons"

function AppTopbar({
  title,
  subtitle,
  theme,
  onToggleTheme,
  toolbar,
  onNewTransaction,
}) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-titles">
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <div className="app-topbar-actions">
        {toolbar}
        {onNewTransaction && (
          <button
            type="button"
            className="btn-primary app-topbar-new-txn"
            onClick={onNewTransaction}
          >
            <Icon name="plus-circle" size={18} />
            New transaction
          </button>
        )}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  )
}

export default AppTopbar
