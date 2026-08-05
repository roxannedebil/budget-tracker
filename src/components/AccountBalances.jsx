import { getAccountActivity } from "../utils/accountStats"
import { getAccountIcon } from "../utils/accounts"
import { formatMoney } from "../utils/transactionStats"

function AccountBalances({ accounts, transactions }) {
  const activity = getAccountActivity(accounts, transactions)

  if (!activity.length) return null

  const totalBalance = activity.reduce((sum, a) => sum + a.balance, 0)

  return (
    <div className="card account-balances-card module-card">
      <div className="card-header">
        <h2>Account balances</h2>
        <span className="chip">{formatMoney(totalBalance)} total</span>
      </div>
      <div className="account-balance-grid">
        {activity.map((account) => (
          <div key={account.account_id} className="account-balance-item">
            <span className="account-balance-name">
              {getAccountIcon(account.account_type)} {account.name}
            </span>
            <span
              className={`account-balance-value ${account.balance >= 0 ? "positive" : "negative"}`}
            >
              {formatMoney(account.balance)}
            </span>
            <span className="account-balance-meta">
              {account.spent > 0 && `${formatMoney(account.spent)} spent`}
              {account.transferredIn > 0 &&
                `${account.spent > 0 ? " · " : ""}${formatMoney(account.transferredIn)} in`}
              {account.transferredOut > 0 &&
                `${account.spent > 0 || account.transferredIn > 0 ? " · " : ""}${formatMoney(account.transferredOut)} out`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AccountBalances
