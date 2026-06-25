import { formatDisplayDate } from "./formatDate"
import { accountLabel } from "./accounts"

export function formatAccountsCell(t, accounts) {
  if (t.type === "income") {
    return accountLabel(accounts, t.to_account_id)
  }
  if (t.type === "expense") {
    return accountLabel(accounts, t.from_account_id)
  }
  if (t.type === "transfer") {
    return `${accountLabel(accounts, t.from_account_id)} → ${accountLabel(accounts, t.to_account_id)}`
  }
  return "—"
}

export function getTypeLabel(t) {
  if (t.type === "income" && t.income_source === "payroll") return "payroll"
  return t.type ?? ""
}

export function getSearchableDate(t) {
  if (!t.date) return ""
  const d = new Date(t.date)
  return [
    formatDisplayDate(t.date),
    d.toISOString().slice(0, 10),
    String(d.getFullYear()),
  ].join(" ")
}
