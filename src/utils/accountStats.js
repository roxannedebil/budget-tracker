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

export function getAccountActivity(accounts, transactions) {
  return accounts.map((account) => ({
    ...account,
    balance: getAccountBalance(account.account_id, transactions),
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
