import { formatDisplayDate } from "./formatDate"
import { formatCategoryLabel, categorySortKey } from "./categoryDisplay"
import {
  formatAccountsCell,
  getTypeLabel,
} from "./transactionDisplay"

export const DEFAULT_COLUMNS = [
  { id: "date", label: "Date" },
  { id: "accounts", label: "Account(s)" },
  { id: "category", label: "Category" },
  { id: "notes", label: "Notes" },
  { id: "type", label: "Type" },
  { id: "amount", label: "Amount", align: "right" },
]

const COLUMN_ORDER_KEY = "txn-column-order"

export function loadColumnOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLUMN_ORDER_KEY) || "null")
    if (!Array.isArray(saved)) return DEFAULT_COLUMNS.map((c) => c.id)
    const valid = saved.filter((id) =>
      DEFAULT_COLUMNS.some((c) => c.id === id)
    )
    const missing = DEFAULT_COLUMNS.map((c) => c.id).filter(
      (id) => !valid.includes(id)
    )
    return [...valid, ...missing]
  } catch {
    return DEFAULT_COLUMNS.map((c) => c.id)
  }
}

export function saveColumnOrder(order) {
  localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order))
}

export function getColumnDef(id) {
  return DEFAULT_COLUMNS.find((c) => c.id === id)
}

export function getSortValue(t, columnId, accounts) {
  switch (columnId) {
    case "date":
      return new Date(t.date).getTime() || 0
    case "accounts":
      return formatAccountsCell(t, accounts).toLowerCase()
    case "category":
      return categorySortKey(t.category, t.subcategory)
    case "notes":
      return (t.notes || "").toLowerCase()
    case "type":
      return getTypeLabel(t).toLowerCase()
    case "amount":
      return Number(t.amount) || 0
    default:
      return ""
  }
}

export function sortTransactions(transactions, accounts, sort) {
  if (!sort?.column || !sort?.direction) return transactions

  const dir = sort.direction === "asc" ? 1 : -1
  return [...transactions].sort((a, b) => {
    const av = getSortValue(a, sort.column, accounts)
    const bv = getSortValue(b, sort.column, accounts)

    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * dir
    }
    return String(av).localeCompare(String(bv)) * dir
  })
}

export function nextSortDirection(current, column) {
  if (current?.column !== column) return "asc"
  return current.direction === "asc" ? "desc" : "asc"
}

export function formatCellValue(t, columnId, accounts) {
  switch (columnId) {
    case "date":
      return formatDisplayDate(t.date)
    case "accounts":
      return formatAccountsCell(t, accounts)
    case "category":
      return formatCategoryLabel(t.category, t.subcategory)
    case "notes":
      return t.notes || "—"
    case "type":
      return getTypeLabel(t)
    case "amount":
      return Number(t.amount)
    default:
      return ""
  }
}
