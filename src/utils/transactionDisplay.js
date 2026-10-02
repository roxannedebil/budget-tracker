import { formatDisplayDate } from "./formatDate"
import { accountLabel } from "./accounts"
import { formatCategoryLabel } from "./categoryDisplay"
import {
  formatCurrency,
  getTransactionCurrency,
  getTransactionMajorAbs,
} from "./currency"
import { getTransferKey } from "./transferLifecycle"

function transferGroupKey(t) {
  return t?.transfer_id || t?.transfer_group_id || null
}

function sameAccountId(a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

export function resolveTransferEndpoints(allTransactions, key) {
  if (!key || !allTransactions?.length) {
    return { fromId: null, toId: null }
  }
  const legs = allTransactions.filter(
    (x) =>
      sameAccountId(x.transfer_id, key) ||
      sameAccountId(x.transfer_group_id, key)
  )
  const out =
    legs.find((l) => l.type === "transfer_out" || l.type === "transfer") ??
    null
  const inn = legs.find((l) => l.type === "transfer_in") ?? null
  return {
    fromId: out?.from_account_id ?? inn?.from_account_id ?? null,
    toId: out?.to_account_id ?? inn?.to_account_id ?? null,
  }
}

function labelAccount(prefix, name) {
  if (!name || name === "—") return null
  return `${prefix}: ${name}`
}

function formatFeeRoutingNotesLine(chargedName, fromName, toName) {
  const hasRoute =
    fromName && fromName !== "—" && toName && toName !== "—"
  const hasCharged = chargedName && chargedName !== "—"
  if (hasCharged && hasRoute) {
    return `Charged to: ${chargedName} (${fromName} → ${toName})`
  }
  if (hasCharged) return `Charged to: ${chargedName}`
  if (hasRoute) return `${fromName} → ${toName}`
  return ""
}

function isTransferTransaction(t) {
  const type = t?.type
  return type === "transfer" || type === "transfer_out" || type === "transfer_in"
}

/** Fee row category column — always "Fees". */
export function getFeeCategoryLabel() {
  return "Fees"
}

/** Transfer row category column from leg type (falls back to stored category). */
export function getTransferCategoryLabel(type, storedCategory) {
  const stored = storedCategory?.trim()
  if (stored && stored !== "Transfer") return stored
  if (type === "transfer_out") return "Transfer out"
  if (type === "transfer_in") return "Transfer in"
  return "Transfer"
}

/** Transfer routing for the Notes column (From or To, per leg). */
export function getTransferDetailsNotesLine(
  t,
  accounts,
  allTransactions = [],
  accountId = null
) {
  if (!isTransferTransaction(t)) return ""

  const key = getTransferKey(t)
  const { fromId, toId } = resolveTransferEndpoints(allTransactions, key)

  if (t.type === "transfer_out") {
    const toName = accountLabel(accounts, toId ?? t.to_account_id)
    return labelAccount("To", toName) || ""
  }
  if (t.type === "transfer_in") {
    const fromName = accountLabel(accounts, fromId ?? t.from_account_id)
    return labelAccount("From", fromName) || ""
  }

  if (accountId != null) {
    const isOut = String(t.from_account_id) === String(accountId)
    const otherId = isOut ? t.to_account_id : t.from_account_id
    const otherName = accountLabel(accounts, otherId)
    return labelAccount(isOut ? "To" : "From", otherName) || ""
  }

  const fromName = accountLabel(accounts, fromId ?? t.from_account_id)
  const toName = accountLabel(accounts, toId ?? t.to_account_id)
  const fromPart = labelAccount("From", fromName)
  const toPart = labelAccount("To", toName)
  if (fromPart && toPart) return `${fromPart} · ${toPart}`
  return fromPart || toPart || ""
}

/** Fee routing details for the Notes column. */
export function getFeeDetailsNotesLine(feeTxn, accounts, allTransactions = []) {
  if (!feeTxn) return ""
  const key = transferGroupKey(feeTxn)
  const { fromId, toId } = resolveTransferEndpoints(allTransactions, key)
  const chargedName = accountLabel(accounts, feeTxn.from_account_id)
  const fromName = accountLabel(accounts, fromId)
  const toName = accountLabel(accounts, toId)

  return formatFeeRoutingNotesLine(chargedName, fromName, toName)
}

export function getFeeChargedAccountName(feeTxn, accounts) {
  return accountLabel(accounts, feeTxn?.from_account_id)
}

function transferKeyMatches(t, key) {
  if (!key || !t) return false
  return (
    sameAccountId(t.transfer_id, key) || sameAccountId(t.transfer_group_id, key)
  )
}

/** Fee row in the same transfer group as this leg (if any). */
export function getLinkedTransferFee(txn, allTransactions = []) {
  if (!txn || !allTransactions.length) return null
  if (!["transfer", "transfer_out", "transfer_in"].includes(txn.type)) {
    return null
  }
  const key = getTransferKey(txn)
  if (!key) return null
  return (
    allTransactions.find((t) => t.type === "fee" && transferKeyMatches(t, key)) ??
    null
  )
}

export function formatInlineTransferFeeSummary(feeTxn, accounts) {
  if (!feeTxn) return ""
  const amt = formatCurrency(
    getTransactionMajorAbs(feeTxn),
    getTransactionCurrency(feeTxn)
  )
  const charged = accountLabel(accounts, feeTxn.from_account_id)
  if (charged !== "—") {
    return `Fee: ${amt} · Charged to: ${charged}`
  }
  return `Fee: ${amt}`
}

/** Notes column; fees and transfers include routing details. */
export function getNotesWithFeeContext(
  t,
  accounts,
  allTransactions = [],
  accountId = null
) {
  if (t.type === "fee") {
    const userNotes = t.notes?.trim() || ""
    const details = getFeeDetailsNotesLine(t, accounts, allTransactions)
    if (userNotes && details) return `${userNotes} · ${details}`
    return userNotes || details || "—"
  }
  if (isTransferTransaction(t)) {
    const userNotes = t.notes?.trim() || ""
    const details = getTransferDetailsNotesLine(
      t,
      accounts,
      allTransactions,
      accountId
    )
    if (userNotes && details) return `${userNotes} · ${details}`
    return userNotes || details || "—"
  }
  return t.notes?.trim() || "—"
}

/** Category column for account history, calendar, etc. */
export function getTransactionCategoryCell(
  t,
  accounts,
  { accountId = null, allTransactions = [] } = {}
) {
  if (t.type === "fee") {
    return getFeeCategoryLabel()
  }
  if (isTransferTransaction(t)) {
    return getTransferCategoryLabel(t.type, t.category)
  }
  return formatCategoryLabel(t.category, t.subcategory) || "—"
}

export function getTransactionAmountPrefix(type, { accountId, transaction } = {}) {
  if (type === "expense" || type === "fee" || type === "transfer_out") return "−"
  if (type === "income" || type === "transfer_in") return "+"
  if (type === "transfer" && accountId && transaction) {
    return transaction.from_account_id === accountId ? "−" : "+"
  }
  if (type === "transfer") return "⇄"
  return "+"
}

export function formatAccountsCell(t, accounts, allTransactions = []) {
  if (t.type === "income") {
    return accountLabel(accounts, t.to_account_id)
  }
  if (t.type === "expense") {
    return accountLabel(accounts, t.from_account_id)
  }
  if (t.type === "transfer") {
    const { fromId, toId } = resolveTransferEndpoints(
      allTransactions,
      getTransferKey(t)
    )
    const fromName = accountLabel(accounts, fromId ?? t.from_account_id)
    const toName = accountLabel(accounts, toId ?? t.to_account_id)
    return `${fromName} → ${toName}`
  }
  if (
    t.type === "transfer_out" ||
    t.type === "transfer_in"
  ) {
    const key = getTransferKey(t)
    const { fromId, toId } = resolveTransferEndpoints(allTransactions, key)
    const fromName = accountLabel(accounts, fromId ?? t.from_account_id)
    const toName = accountLabel(accounts, toId ?? t.to_account_id)
    if (fromName !== "—" && toName !== "—") {
      return `${fromName} → ${toName}`
    }
    if (t.type === "transfer_out") {
      return fromName !== "—" ? `${fromName} → …` : "—"
    }
    return toName !== "—" ? `… → ${toName}` : "—"
  }
  if (t.type === "fee") {
    const key = getTransferKey(t)
    const { fromId, toId } = resolveTransferEndpoints(allTransactions, key)
    const fromName = accountLabel(accounts, fromId)
    const toName = accountLabel(accounts, toId)
    const charged = accountLabel(accounts, t.from_account_id)
    const line = formatFeeRoutingNotesLine(charged, fromName, toName)
    return line || "—"
  }
  return "—"
}

/** Type column labels: Income | Expense | Out | In | Fee */
export function getTableTypeLabel(t, accountId = null) {
  const type = typeof t === "string" ? t : t?.type ?? ""
  switch (type) {
    case "income":
      return "Income"
    case "expense":
      return "Expense"
    case "fee":
      return "Fee"
    case "transfer_out":
      return "Out"
    case "transfer_in":
      return "In"
    case "transfer":
      if (accountId != null && typeof t === "object" && t) {
        if (String(t.from_account_id) === String(accountId)) return "Out"
        if (String(t.to_account_id) === String(accountId)) return "In"
      }
      return "Out"
    default:
      return type ? String(type).replace(/_/g, " ") : ""
  }
}

export function getTransactionTypeDisplayLabel(typeOrTxn, accountId = null) {
  return getTableTypeLabel(typeOrTxn, accountId)
}

/** Human-readable type for tables, pills, and summaries. */
export function getTypeLabel(t, accountId = null) {
  return getTableTypeLabel(t, accountId)
}

/** CSS pill/badge key: income | expense | transfer */
export function getTypePillClass(type) {
  if (type === "expense" || type === "fee") return "expense"
  if (type === "income") return "income"
  if (
    type === "transfer" ||
    type === "transfer_in" ||
    type === "transfer_out"
  ) {
    return "transfer"
  }
  return "expense"
}

/** Amount column color class aligned with type pills. */
export function getTypeAmountClass(type) {
  if (type === "expense" || type === "fee") return "expense-text"
  if (type === "income") return "income-text"
  return "transfer-text"
}

/** Filter dropdown values: expense | income | transfer */
export function getTypeFilterGroup(t) {
  const type = t?.type
  if (type === "fee" || type === "expense") return "expense"
  if (type === "income") return "income"
  if (
    type === "transfer" ||
    type === "transfer_in" ||
    type === "transfer_out"
  ) {
    return "transfer"
  }
  return type ?? ""
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
