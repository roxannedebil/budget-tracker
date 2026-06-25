function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark"

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      <span className={`theme-toggle-option ${!isDark ? "active" : ""}`}>
        ☀️
      </span>
      <span className={`theme-toggle-option ${isDark ? "active" : ""}`}>
        🌙
      </span>
      <span
        className="theme-toggle-thumb"
        style={{ transform: isDark ? "translateX(100%)" : "translateX(0)" }}
      />
    </button>
  )
}

export default ThemeToggle
