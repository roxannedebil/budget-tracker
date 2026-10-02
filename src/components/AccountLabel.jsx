import { getAccountById, getAccountIcon } from "../utils/accounts"
import { getAccountDisplayColor } from "../utils/accountColor"
import { getTransferKey } from "../utils/transferLifecycle"
import { resolveTransferEndpoints } from "../utils/transactionDisplay"
import Icon from "./icons/Icons"

export function AccountColorDot({ account, accounts, id, className = "" }) {
  const resolved = account ?? getAccountById(accounts, id)
  if (!resolved) return null
  return (
    <span
      className={`account-color-dot ${className}`.trim()}
      style={{ background: getAccountDisplayColor(resolved) }}
      aria-hidden="true"
    />
  )
}

export function AccountLabel({ accounts, id, iconSize = 16, className = "" }) {
  const account = getAccountById(accounts, id)
  if (!account) return "—"

  return (
    <span className={`account-label ${className}`.trim()}>
      <AccountColorDot account={account} />
      <Icon
        name={getAccountIcon(account.account_type)}
        size={iconSize}
        className="account-label-icon"
      />
      <span>{account.name}</span>
    </span>
  )
}

export function AccountsCell({ t, accounts, allTransactions = [] }) {
  if (t.type === "income") {
    return <AccountLabel accounts={accounts} id={t.to_account_id} />
  }
  if (t.type === "expense" || t.type === "fee") {
    return <AccountLabel accounts={accounts} id={t.from_account_id} />
  }
  if (t.type === "transfer") {
    return (
      <span className="accounts-cell-transfer">
        <AccountLabel accounts={accounts} id={t.from_account_id} />
        <Icon name="arrow-right" size={14} className="accounts-cell-arrow" />
        <AccountLabel accounts={accounts} id={t.to_account_id} />
      </span>
    )
  }
  if (t.type === "transfer_in" || t.type === "transfer_out") {
    const key = getTransferKey(t)
    const { fromId, toId } = resolveTransferEndpoints(allTransactions, key)
    return (
      <span className="accounts-cell-transfer">
        <AccountLabel accounts={accounts} id={fromId ?? t.from_account_id} />
        <Icon name="arrow-right" size={14} className="accounts-cell-arrow" />
        <AccountLabel accounts={accounts} id={toId ?? t.to_account_id} />
      </span>
    )
  }
  return "—"
}

export default AccountLabel
