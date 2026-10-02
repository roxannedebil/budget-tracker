import { getAccountBalancesByCurrency } from "./accountStats.js"

export function parseAccountCurrencies(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((c) => String(c).toUpperCase()).filter(Boolean)
  }
  return []
}

/** Currencies user may pick for this account on the Transactions form. */
export function getAccountCurrencyOptions(account) {
  if (!account) return ["PHP"]
  const def = (account.default_currency || "PHP").toUpperCase()
  if (!account.allow_multiple_currencies) {
    return [def]
  }
  const extra = parseAccountCurrencies(account.account_currencies)
  return [...new Set([def, ...extra])]
}

/** Account currencies that are configured and have a positive balance (for sending). */
export function getFundedAccountCurrencyOptions(account, transactions = []) {
  if (!account?.account_id) return []
  const configured = getAccountCurrencyOptions(account)
  const buckets = getAccountBalancesByCurrency(account.account_id, transactions)
  return configured.filter((cur) => (buckets[cur] || 0) > 0)
}

/** Show currency picker only when the account actually has more than one currency. */
export function accountShowsCurrencyPicker(account) {
  if (!account?.allow_multiple_currencies) return false
  return getAccountCurrencyOptions(account).length > 1
}

/** Transfers between the same account require distinct send/receive currencies. */
export function accountAllowsSameAccountTransfer(account) {
  return accountShowsCurrencyPicker(account)
}

export function isSameAccountTransferBlocked(fromAccountId, account) {
  if (!fromAccountId || !account?.account_id) return false
  if (account.account_id !== fromAccountId) return false
  return !accountAllowsSameAccountTransfer(account)
}

/** Hint when the account only supports one currency in forms. */
export function accountSingleCurrencyHint(account) {
  if (!account || accountShowsCurrencyPicker(account)) return null
  const code = getAccountCurrencyOptions(account)[0] || "PHP"
  const name = account.name || "This account"
  return `${name} holds ${code} only. Add more currencies in Accounts.`
}

export function accountDefaultCurrency(account, fallbackPrimary = "PHP") {
  if (!account) return (fallbackPrimary || "PHP").toUpperCase()
  return getAccountCurrencyOptions(account)[0] || (account.default_currency || fallbackPrimary).toUpperCase()
}

/** Dashboard extra lines: from account setup + any non-zero balance (excluding primary). */
export function getDashboardSecondaryCurrencies(accounts, primary, transactions = []) {
  const base = (primary || "PHP").toUpperCase()
  const set = new Set()

  for (const a of accounts || []) {
    const def = (a.default_currency || "PHP").toUpperCase()
    if (def !== base) set.add(def)

    if (a.allow_multiple_currencies) {
      for (const c of parseAccountCurrencies(a.account_currencies)) {
        if (c !== base) set.add(c)
      }
    }
  }

  if (transactions?.length && accounts?.length) {
    for (const a of accounts) {
      const buckets = getAccountBalancesByCurrency(a.account_id, transactions)
      for (const [cur, minor] of Object.entries(buckets)) {
        const code = cur.toUpperCase()
        if (minor !== 0 && code !== base) set.add(code)
      }
    }
  }

  return [...set].sort()
}
