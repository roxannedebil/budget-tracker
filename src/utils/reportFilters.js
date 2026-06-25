import { formatDisplayDate } from "./formatDate"

function pad(n) {
  return String(n).padStart(2, "0")
}

export function toDateInputValue(date) {
  const d = date instanceof Date ? date : new Date(date)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getDefaultReportFilters() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    dateFrom: toDateInputValue(start),
    dateTo: toDateInputValue(now),
    type: "",
    category: "",
  }
}

export const DATE_RANGE_PRESETS = [
  {
    id: "this-month",
    label: "This month",
    getRange: () => {
      const now = new Date()
      return {
        dateFrom: toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1)),
        dateTo: toDateInputValue(now),
      }
    },
  },
  {
    id: "last-month",
    label: "Last month",
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { dateFrom: toDateInputValue(start), dateTo: toDateInputValue(end) }
    },
  },
  {
    id: "last-3-months",
    label: "Last 3 months",
    getRange: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { dateFrom: toDateInputValue(start), dateTo: toDateInputValue(now) }
    },
  },
  {
    id: "this-year",
    label: "This year",
    getRange: () => {
      const now = new Date()
      return {
        dateFrom: toDateInputValue(new Date(now.getFullYear(), 0, 1)),
        dateTo: toDateInputValue(now),
      }
    },
  },
  {
    id: "all-time",
    label: "All time",
    getRange: () => ({ dateFrom: "", dateTo: "" }),
  },
]

export function formatFilterDateRange(filters) {
  if (!filters.dateFrom && !filters.dateTo) return "All time"
  if (filters.dateFrom && filters.dateTo) {
    return `${formatDisplayDate(filters.dateFrom)} – ${formatDisplayDate(filters.dateTo)}`
  }
  if (filters.dateFrom) return `From ${formatDisplayDate(filters.dateFrom)}`
  return `Until ${formatDisplayDate(filters.dateTo)}`
}

export function filterReportTransactions(transactions, filters) {
  return transactions.filter((t) => {
    const txDate = t.date ? new Date(t.date) : null

    if (filters.dateFrom && txDate) {
      const from = new Date(filters.dateFrom)
      from.setHours(0, 0, 0, 0)
      if (txDate < from) return false
    }

    if (filters.dateTo && txDate) {
      const to = new Date(filters.dateTo)
      to.setHours(23, 59, 59, 999)
      if (txDate > to) return false
    }

    if (filters.type && t.type !== filters.type) return false

    if (filters.category && t.category !== filters.category) return false

    return true
  })
}
