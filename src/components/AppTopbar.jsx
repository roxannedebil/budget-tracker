import ThemeToggle from "./ThemeToggle"

function AppTopbar({ title, subtitle, theme, onToggleTheme }) {
  return (
    <header className="app-topbar">
      <div className="app-topbar-titles">
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
    </header>
  )
}

export default AppTopbar
