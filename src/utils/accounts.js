export const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank", icon: "bank" },
  { value: "ewallet", label: "E-wallet", icon: "smartphone" },
  { value: "cash", label: "Cash", icon: "banknote" },
]

export function getAccountTypeLabel(type) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}

export function getAccountIcon(type) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? "credit-card"
}

export function getAccountById(accounts, id) {
  if (!id) return null
  return accounts.find((a) => a.account_id === id) ?? null
}

export function accountLabel(accounts, id) {
  const account = getAccountById(accounts, id)
  if (!account) return "—"
  return account.name
}

export function filterAccountsByType(accounts, type) {
  return accounts.filter((a) => a.account_type === type)
}
