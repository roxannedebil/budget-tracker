import { formatDisplayDate } from "./formatDate"

export function getIncome(transactions) {
  return transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function getExpenses(transactions) {
  return transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function getBalance(transactions) {
  return getIncome(transactions) - getExpenses(transactions)
}

export function filterByMonth(transactions, year, month) {
  return transactions.filter((t) => {
    const d = new Date(t.date)
    return d.getFullYear() === year && d.getMonth() === month
  })
}

export function getCurrentMonthTransactions(transactions) {
  const now = new Date()
  return filterByMonth(transactions, now.getFullYear(), now.getMonth())
}

export function groupByCategory(transactions, type = "expense") {
  const groups = {}

  transactions
    .filter((t) => t.type === type)
    .forEach((t) => {
      const key = t.category || "Uncategorized"
      groups[key] = (groups[key] || 0) + Number(t.amount)
    })

  return Object.entries(groups)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
}

export function groupByMonth(transactions) {
  const groups = {}

  transactions.forEach((t) => {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!groups[key]) {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      groups[key] = {
        income: 0,
        expense: 0,
        label: formatDisplayDate(monthStart),
      }
    }
    if (t.type === "income") {
      groups[key].income += Number(t.amount)
    } else if (t.type === "expense") {
      groups[key].expense += Number(t.amount)
    }
  })

  return Object.entries(groups)
    .map(([key, data]) => ({ key, ...data }))
    .sort((a, b) => b.key.localeCompare(a.key))
}

export function getRecentMonthsTrend(transactions, count = 6) {
  const sorted = [...groupByMonth(transactions)].sort((a, b) =>
    a.key.localeCompare(b.key)
  )
  const recent = sorted.slice(-count)

  return recent.map((m) => {
    const [year, month] = m.key.split("-").map(Number)
    const d = new Date(year, month - 1, 1)
    const shortLabel = d.toLocaleString("default", { month: "short" })
    return { ...m, shortLabel }
  })
}

export function formatMoney(amount) {
  return `₱${Number(amount).toLocaleString()}`
}
