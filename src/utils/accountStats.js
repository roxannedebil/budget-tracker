export function getAccountBalance(accountId, transactions) {
  if (!accountId) return 0

  return transactions.reduce((balance, t) => {
    const amount = Number(t.amount)

    if (t.type === "income" && t.to_account_id === accountId) {
      return balance + amount
    }
    if (t.type === "expense" && t.from_account_id === accountId) {
      return balance - amount
    }
    if (t.type === "transfer") {
      if (t.from_account_id === accountId) return balance - amount
      if (t.to_account_id === accountId) return balance + amount
    }
    return balance
  }, 0)
}

export function getPayrollIncome(transactions) {
  return transactions
    .filter((t) => t.type === "income" && t.income_source === "payroll")
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function getTransferredTo(accountId, transactions) {
  return transactions
    .filter((t) => t.type === "transfer" && t.to_account_id === accountId)
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function getTransferredFrom(accountId, transactions) {
  return transactions
    .filter((t) => t.type === "transfer" && t.from_account_id === accountId)
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function getSpentFrom(accountId, transactions) {
  return transactions
    .filter((t) => t.type === "expense" && t.from_account_id === accountId)
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function getIncomeTo(accountId, transactions) {
  return transactions
    .filter((t) => t.type === "income" && t.to_account_id === accountId)
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function getTransactionsForAccount(accountId, transactions) {
  if (!accountId) return []

  return transactions.filter((t) => {
    if (t.type === "income") return t.to_account_id === accountId
    if (t.type === "expense") return t.from_account_id === accountId
    if (t.type === "transfer") {
      return (
        t.from_account_id === accountId || t.to_account_id === accountId
      )
    }
    return false
  })
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
  return accounts.map((account) => ({
    ...account,
    balance: getAccountBalance(account.account_id, transactions),
    income: getIncomeTo(account.account_id, transactions),
    transferredIn: getTransferredTo(account.account_id, transactions),
    transferredOut: getTransferredFrom(account.account_id, transactions),
    spent: getSpentFrom(account.account_id, transactions),
  }))
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
