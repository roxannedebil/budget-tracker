export const ACCOUNT_TYPES = [
  { value: "bank", label: "Bank", icon: "🏦" },
  { value: "ewallet", label: "E-wallet", icon: "📱" },
  { value: "cash", label: "Cash", icon: "💵" },
]

export function getAccountTypeLabel(type) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? type
}

export function getAccountIcon(type) {
  return ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? "💳"
}

export function getAccountById(accounts, id) {
  if (!id) return null
  return accounts.find((a) => a.account_id === id) ?? null
}

export function accountLabel(accounts, id) {
  const account = getAccountById(accounts, id)
  if (!account) return "—"
  return `${getAccountIcon(account.account_type)} ${account.name}`
}

export function filterAccountsByType(accounts, type) {
  return accounts.filter((a) => a.account_type === type)
}
