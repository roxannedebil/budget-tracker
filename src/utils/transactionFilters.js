import {
  formatAccountsCell,
  getTypeLabel,
} from "./transactionDisplay"

export function getDefaultFilters() {
  return {
    dateFrom: "",
    dateTo: "",
    amountMin: "",
    amountMax: "",
    type: "",
    category: "",
    keyword: "",
  }
}

export function hasActiveFilters(filters) {
  return Object.values(filters).some((v) => String(v).trim() !== "")
}

function keywordMatch(t, accounts, keyword) {
  if (!keyword.trim()) return true
  const q = keyword.trim().toLowerCase()
  const haystack = [
    t.category,
    t.notes,
    t.type,
    getTypeLabel(t),
    String(t.amount),
    formatAccountsCell(t, accounts),
    t.date,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return haystack.includes(q)
}

export function filterTransactions(transactions, accounts, filters) {
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

    const amount = Number(t.amount)
    if (filters.amountMin !== "" && amount < Number(filters.amountMin)) {
      return false
    }
    if (filters.amountMax !== "" && amount > Number(filters.amountMax)) {
      return false
    }

    if (filters.type && getTypeLabel(t) !== filters.type) return false

    if (
      filters.category &&
      !String(t.category ?? "")
        .toLowerCase()
        .includes(filters.category.trim().toLowerCase())
    ) {
      return false
    }

    if (!keywordMatch(t, accounts, filters.keyword)) return false

    return true
  })
}

export function paginateItems(items, page, pageSize) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  const end = Math.min(start + pageSize, total)

  return {
    items: items.slice(start, end),
    page: safePage,
    pageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : start + 1,
    end,
  }
}
