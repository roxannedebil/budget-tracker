import { getAccountById, getAccountIcon } from "../utils/accounts"
import Icon from "./icons/Icons"

export function AccountLabel({ accounts, id, iconSize = 16, className = "" }) {
  const account = getAccountById(accounts, id)
  if (!account) return "—"

  return (
    <span className={`account-label ${className}`.trim()}>
      <Icon
        name={getAccountIcon(account.account_type)}
        size={iconSize}
        className="account-label-icon"
      />
      <span>{account.name}</span>
    </span>
  )
}

export function AccountsCell({ t, accounts }) {
  if (t.type === "income") {
    return <AccountLabel accounts={accounts} id={t.to_account_id} />
  }
  if (t.type === "expense") {
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
  return "—"
}

export default AccountLabel
