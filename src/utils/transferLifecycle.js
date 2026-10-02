import {
  formatCurrency,
  getTransactionCurrency,
  getTransactionMajorAbs,
  minorToMajor,
} from "./currency.js"
import { accountLabel } from "./accounts.js"
import { accountDefaultCurrency } from "./accountCurrencies.js"

/** Canonical group id: prefer transfer_id, then transfer_group_id. */
export function getTransferKey(transaction) {
  if (!transaction) return null
  return transaction.transfer_id || transaction.transfer_group_id || null
}

export function isLegacySingleTransfer(transaction) {
  if (!transaction) return false
  return transaction.type === "transfer" && !getTransferKey(transaction)
}

export function isLinkedTransferFee(transaction) {
  return transaction?.type === "fee" && Boolean(getTransferKey(transaction))
}

/** Whole-transfer RPC vs single-row delete (income, expense, standalone fee). */
export function shouldDeleteViaTransferRpc(transaction) {
  if (!transaction) return false
  const type = transaction.type
  if (type === "income" || type === "expense") return false
  if (type === "fee" && !getTransferKey(transaction)) return false
  return (
    isLegacySingleTransfer(transaction) ||
    Boolean(getTransferKey(transaction)) ||
    type === "transfer"
  )
}

export function isGroupedTransfer(transaction) {
  if (!transaction) return false
  if (isLegacySingleTransfer(transaction)) return false
  const key = getTransferKey(transaction)
  if (!key) return false
  return ["transfer_out", "transfer_in", "fee", "transfer"].includes(transaction.type)
}

export function getTransferLegs(transaction, allTransactions = []) {
  if (!transaction) return []
  if (isLegacySingleTransfer(transaction)) return [transaction]

  const key = getTransferKey(transaction)
  if (!key) return [transaction]

  const keyStr = String(key)
  return allTransactions.filter(
    (t) =>
      (t.transfer_id != null && String(t.transfer_id) === keyStr) ||
      (t.transfer_group_id != null && String(t.transfer_group_id) === keyStr)
  )
}

/** Row to use for edit/delete actions (whole transfer, not one leg). */
export function resolveTransferActionTarget(transaction, allTransactions = []) {
  if (!transaction) return null
  if (transaction.type === "fee" && getTransferKey(transaction)) {
    const legs = getTransferLegs(transaction, allTransactions)
    const anchor =
      legs.find((t) => t.type === "transfer_out") ||
      legs.find((t) => t.type === "transfer") ||
      legs.find((t) => t.type !== "fee")
    if (anchor) return resolveTransferActionTarget(anchor, allTransactions)
  }
  if (isLegacySingleTransfer(transaction)) return transaction

  const legs = getTransferLegs(transaction, allTransactions)
  if (legs.length === 0) return transaction

  return (
    legs.find((t) => t.type === "transfer_out") ||
    legs.find((t) => t.type === "transfer") ||
    legs[0]
  )
}

/** Receive currency for a pending transfer (header, else destination account, else send leg). */
export function resolvePendingReceiveCurrency({
  transferHeader,
  transferOut,
  toAccount,
  primary = "PHP",
}) {
  if (transferHeader?.receive_currency) {
    return String(transferHeader.receive_currency).toUpperCase()
  }
  if (toAccount) {
    return accountDefaultCurrency(toAccount, primary)
  }
  return getTransactionCurrency(transferOut)
}

export function isPendingCrossCurrencyTransfer({
  transferHeader,
  transferOut,
  toAccount,
  primary = "PHP",
}) {
  if (!transferOut) return false
  const send = getTransactionCurrency(transferOut)
  const recv = resolvePendingReceiveCurrency({
    transferHeader,
    transferOut,
    toAccount,
    primary,
  })
  return send !== recv
}

export function getPendingTransferOutSendMajor(transferOut) {
  return getTransactionMajorAbs(transferOut)
}

export function isPendingTransferGroup(transaction, allTransactions = []) {
  const target = resolveTransferActionTarget(transaction, allTransactions)
  const legs = getTransferLegs(target, allTransactions)
  const out = legs.find((t) => t.type === "transfer_out")
  if (!out || out.status !== "pending") return false
  return !legs.some((t) => t.type === "transfer_in")
}

/** Pending transfer_out (and related rows in the group) may be edited from the list. */
export function canEditTransactionRow(transaction, allTransactions = []) {
  if (!transaction) return false
  if (isLinkedTransferFee(transaction)) return false
  const target = resolveTransferActionTarget(transaction, allTransactions)
  if (isPendingTransferGroup(target, allTransactions)) return true
  if (target?.type === "income" || target?.type === "expense") return true
  if (target?.type === "fee" && !getTransferKey(target)) return true
  return !isTransferTransactionRow(transaction, allTransactions)
}

/** Any row that belongs to a transfer (no inline edit on Transactions list). */
export function isTransferTransactionRow(transaction, allTransactions = []) {
  if (!transaction) return false
  if (isLegacySingleTransfer(transaction)) return true
  if (transaction.type === "transfer") return true
  if (isLinkedTransferFee(transaction)) return true
  if (transaction.type === "transfer_in" || transaction.type === "transfer_out") {
    return true
  }
  return isGroupedTransfer(transaction)
}

/** Completed transfer groups cannot be edited (delete and re-create). */
export function isCompletedTransferGroup(transaction, allTransactions = []) {
  if (!transaction) return false
  const target = resolveTransferActionTarget(transaction, allTransactions)
  if (!target) return false

  if (target.type === "income" || target.type === "expense") return false
  if (target.type === "fee" && !getTransferKey(target)) return false

  if (isPendingTransferGroup(target, allTransactions)) return false

  if (isLegacySingleTransfer(target)) {
    return (target.status || "completed") !== "pending"
  }

  const legs = getTransferLegs(target, allTransactions)
  if (legs.some((t) => t.type === "transfer_in")) return true

  const key = getTransferKey(target)
  if (key && legs.length > 0) {
    const out = legs.find((t) => t.type === "transfer_out")
    if (out?.status === "pending") return false
    return true
  }

  return target.type === "transfer"
}

export function getTransferGroupTransactionIds(transaction, allTransactions = []) {
  const legs = getTransferLegs(
    resolveTransferActionTarget(transaction, allTransactions),
    allTransactions
  )
  return legs.map((t) => t.transaction_id ?? t.id).filter(Boolean)
}

function signedMajorForDeleteReversal(t, accountId) {
  const cur = getTransactionCurrency(t)
  const minor =
    t.amount_minor != null
      ? Number(t.amount_minor)
      : Math.round(Number(t.amount || 0) * 100)

  if (t.type === "income" || t.type === "transfer_in") {
    if (t.to_account_id === accountId) return { cur, major: -minorToMajor(minor, cur) }
  }
  if (t.type === "expense" || t.type === "fee" || t.type === "transfer_out") {
    if (t.from_account_id === accountId) return { cur, major: -minorToMajor(minor, cur) }
  }
  if (t.type === "transfer") {
    const abs = Math.abs(minorToMajor(minor, cur))
    if (t.from_account_id === accountId) return { cur, major: abs }
    if (t.to_account_id === accountId) return { cur, major: -abs }
  }
  return null
}

/**
 * Balance effect if the whole transfer is deleted (reverses each leg).
 * e.g. "ChinaBank PHP +₱5,850, Cash USD −$100"
 */
export function getTransferDeleteBalanceEffects(legs, accounts) {
  const totals = new Map()

  for (const t of legs) {
    const accountIds = []
    if (t.from_account_id) accountIds.push(t.from_account_id)
    if (t.to_account_id) accountIds.push(t.to_account_id)

    for (const accountId of accountIds) {
      const rev = signedMajorForDeleteReversal(t, accountId)
      if (!rev || !Number.isFinite(rev.major) || rev.major === 0) continue
      const key = `${accountId}|${rev.cur}`
      totals.set(key, (totals.get(key) || 0) + rev.major)
    }
  }

  const lines = []
  for (const [key, major] of totals.entries()) {
    const [accountId, cur] = key.split("|")
    const name = accountLabel(accounts, accountId)
    const sign = major >= 0 ? "+" : "−"
    lines.push(`${name} ${cur}: ${sign}${formatCurrency(Math.abs(major), cur)}`)
  }

  return lines
}

export function formatTransferDeleteConfirmMessage(transaction, allTransactions, accounts) {
  const target = resolveTransferActionTarget(transaction, allTransactions)
  const legs = getTransferLegs(target, allTransactions)

  if (isLegacySingleTransfer(target)) {
    const effects = getTransferDeleteBalanceEffects(legs, accounts)
    const effectText =
      effects.length > 0 ? ` Balance effect: ${effects.join(", ")}.` : ""
    return `Delete this transfer?${effectText} This cannot be undone.`
  }

  const effects = getTransferDeleteBalanceEffects(legs, accounts)
  const effectText =
    effects.length > 0
      ? effects.join(", ")
      : "all linked legs of this transfer"

  const pending = isPendingTransferGroup(target, allTransactions)
  const scope = pending
    ? "This deletes the whole pending transfer and its send leg."
    : "This deletes the whole transfer (including any fee rows)."

  return `${scope} Balance effect: ${effectText}. This cannot be undone.`
}
