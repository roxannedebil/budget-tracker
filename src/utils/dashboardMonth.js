const KEY = "koinest_dashboard_month"

export function readDashboardMonth() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const [y, m] = raw.split("-").map(Number)
    if (!y || !m) return null
    return { year: y, month: m - 1 }
  } catch {
    return null
  }
}

export function writeDashboardMonth(year, month) {
  sessionStorage.setItem(
    KEY,
    `${year}-${String(month + 1).padStart(2, "0")}`
  )
}

export function isCurrentMonth(year, month) {
  const now = new Date()
  return now.getFullYear() === year && now.getMonth() === month
}
