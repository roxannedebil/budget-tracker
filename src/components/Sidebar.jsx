import UserAvatar from "./UserAvatar"
import { getAvatarUrl, getDisplayName } from "../utils/profile"

function Sidebar({
  activePage,
  setActivePage,
  collapsed,
  onToggleCollapse,
  session,
  profile,
  onLogout,
}) {
  const user = session?.user
  const displayName = getDisplayName(profile, user)
  const avatarUrl = getAvatarUrl(profile, user)
  const email = user?.email || ""

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "transactions", label: "Transactions", icon: "💳" },
    { id: "budget", label: "Budget", icon: "📁" },
    { id: "reports", label: "Reports", icon: "📈" },
  ]

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-top">
        {!collapsed && <h3>Budget Tracker</h3>}
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "active" : ""}
            onClick={() => setActivePage(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className={`sidebar-profile ${activePage === "profile" ? "active" : ""}`}
          onClick={() => setActivePage("profile")}
          title={collapsed ? "Profile" : undefined}
        >
          <UserAvatar
            src={avatarUrl}
            name={displayName}
            size={collapsed ? "sm" : "md"}
          />
          {!collapsed && (
            <span className="sidebar-profile-text">
              <span className="sidebar-profile-name">{displayName}</span>
              <span className="sidebar-profile-email">{email}</span>
            </span>
          )}
        </button>

        <button
          type="button"
          className="sidebar-action logout"
          onClick={onLogout}
          title="Log out"
        >
          <span className="nav-icon">🚪</span>
          {!collapsed && <span className="nav-label">Log out</span>}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
