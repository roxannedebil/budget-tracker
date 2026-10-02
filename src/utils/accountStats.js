import { getTransactionCurrency, minorToMajor } from "./currency.js"

function affectsAccount(t, accountId) {
  if (t.type === "income" || t.type === "transfer_in") {
    return t.to_account_id === accountId
  }
  if (t.type === "expense" || t.type === "fee" || t.type === "transfer_out") {
    return t.from_account_id === accountId
  }
  if (t.type === "transfer") {
    return t.from_account_id === accountId || t.to_account_id === accountId
  }
  if (t.type === "other") {
    return t.from_account_id === accountId || t.to_account_id === accountId
  }
  return false
}

function signedMinorDelta(t, accountId) {
  const cur = getTransactionCurrency(t)
  const minor =
    t.amount_minor != null
      ? Number(t.amount_minor)
      : Math.round(Number(t.amount) * 100) * (t.type === "expense" ? -1 : 1)

  if (t.type === "income" || t.type === "transfer_in") {
    if (t.to_account_id === accountId) return { [cur]: minor }
  }
  if (t.type === "expense" || t.type === "fee" || t.type === "transfer_out") {
    if (t.from_account_id === accountId) return { [cur]: minor }
  }
  if (t.type === "transfer") {
    const abs = Math.abs(minor)
    if (t.from_account_id === accountId) return { [cur]: -abs }
    if (t.to_account_id === accountId) return { [cur]: abs }
  }
  if (t.type === "other") {
    if (t.to_account_id === accountId) return { [cur]: minor }
    if (t.from_account_id === accountId) return { [cur]: minor }
  }
  return {}
}

export function getAccountBalancesByCurrency(accountId, transactions) {
  if (!accountId) return {}

  return transactions.reduce((acc, t) => {
    if (!affectsAccount(t, accountId)) return acc
    const delta = signedMinorDelta(t, accountId)
    for (const [cur, m] of Object.entries(delta)) {
      acc[cur] = (acc[cur] || 0) + m
    }
    return acc
  }, {})
}

/**
 * Apply one ledger row to running balances (major units). keyFn(accountId, currency) → map key.
 */
export function applyTransactionToRunningBalances(balances, t, keyFn) {
  if (!t || !keyFn) return
  const accountIds = [t.from_account_id, t.to_account_id].filter(Boolean)
  for (const accountId of accountIds) {
    if (!affectsAccount(t, accountId)) continue
    const delta = signedMinorDelta(t, accountId)
    for (const [cur, minor] of Object.entries(delta)) {
      const key = keyFn(accountId, cur)
      balances.set(key, (balances.get(key) ?? 0) + minorToMajor(minor, cur))
    }
  }
}

export function getAccountBalance(accountId, transactions, displayCurrency) {
  const buckets = getAccountBalancesByCurrency(accountId, transactions)
  if (displayCurrency) {
    const cur = displayCurrency.toUpperCase()
    return minorToMajor(buckets[cur] || 0, cur)
  }
  const keys = Object.keys(buckets)
  if (keys.length === 0) return 0
  if (keys.length === 1) return minorToMajor(buckets[keys[0]], keys[0])
  return keys.reduce(
    (sum, cur) => sum + minorToMajor(buckets[cur], cur),
    0
  )
}

export function getPayrollIncome(transactions) {
  return transactions
    .filter((t) => t.type === "income" && t.income_source === "payroll")
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
}

export function getTransferredTo(accountId, transactions) {
  return transactions
    .filter(
      (t) =>
        (t.type === "transfer" && t.to_account_id === accountId) ||
        (t.type === "transfer_in" && t.to_account_id === accountId)
    )
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
}

export function getTransferredFrom(accountId, transactions) {
  return transactions
    .filter(
      (t) =>
        (t.type === "transfer" && t.from_account_id === accountId) ||
        (t.type === "transfer_out" && t.from_account_id === accountId)
    )
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
}

export function getSpentFrom(accountId, transactions) {
  return transactions
    .filter(
      (t) =>
        (t.type === "expense" || t.type === "fee") &&
        t.from_account_id === accountId
    )
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
}

export function getIncomeTo(accountId, transactions) {
  return transactions
    .filter((t) => t.type === "income" && t.to_account_id === accountId)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)
}

export function getTransactionsForAccount(accountId, transactions) {
  if (!accountId) return []

  return transactions.filter((t) => affectsAccount(t, accountId))
}

export function groupTransactionsByMonthLabel(transactions) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const groups = []
  let current = null

  for (const t of sorted) {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleString("default", {
      month: "long",
      year: "numeric",
    })

    if (!current || current.key !== key) {
      current = { key, label, items: [] }
      groups.push(current)
    }
    current.items.push(t)
  }

  return groups
}

export function getAccountActivity(accounts, transactions) {
  return accounts.map((account) => {
    const buckets = getAccountBalancesByCurrency(account.account_id, transactions)
    const defaultCur = (account.default_currency || "PHP").toUpperCase()
    const balance = getAccountBalance(account.account_id, transactions, defaultCur)

    return {
      ...account,
      balance,
      balanceByCurrency: buckets,
      income: getIncomeTo(account.account_id, transactions),
      transferredIn: getTransferredTo(account.account_id, transactions),
      transferredOut: getTransferredFrom(account.account_id, transactions),
      spent: getSpentFrom(account.account_id, transactions),
    }
  })
}

export function getTransfersByDestination(accounts, transactions) {
  return accounts
    .map((account) => ({
      account,
      total: getTransferredTo(account.account_id, transactions),
    }))
    .filter((item) => item.total > 0)
    .sort((a, b) => b.total - a.total)
}
