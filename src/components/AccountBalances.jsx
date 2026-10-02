import { getAccountActivity } from "../utils/accountStats"
import { AccountLabel } from "./AccountLabel"
import { accountColorStyleVars } from "../utils/accountColor"
import { formatMoney } from "../utils/transactionStats"
import { useCurrency } from "../context/CurrencyContext"
import CurrencyTotalsLines from "./CurrencyTotalsLines"
import { summarizeBalancesByCurrency } from "../utils/monthByCurrency"

function AccountBalances({ accounts, transactions }) {
  const { primary } = useCurrency()
  const activity = getAccountActivity(accounts, transactions)

  if (!activity.length) return null

  const balanceByCurrency = summarizeBalancesByCurrency(accounts, transactions)

  return (
    <div className="card account-balances-card module-card">
      <div className="card-header">
        <h2>Account balances</h2>
        <span className="chip account-balances-total-chip">
          <CurrencyTotalsLines
            rows={balanceByCurrency}
            pick={(r) => r.total}
            stacked
            hideZero={false}
          />
        </span>
      </div>
      <div className="account-balance-grid">
        {activity.map((account) => (
          <div
            key={account.account_id}
            className="account-balance-item has-account-color"
            style={accountColorStyleVars(account)}
          >
            <span className="account-balance-name">
              <AccountLabel
                accounts={accounts}
                id={account.account_id}
                iconSize={16}
              />
            </span>
            <span
              className={`account-balance-value ${account.balance >= 0 ? "positive" : "negative"}`}
            >
              {formatMoney(
                account.balance,
                (account.default_currency || primary).toUpperCase()
              )}
            </span>
            <span className="account-balance-meta">
              {account.spent > 0 &&
                `${formatMoney(account.spent, (account.default_currency || primary).toUpperCase())} spent`}
              {account.transferredIn > 0 &&
                `${account.spent > 0 ? " · " : ""}${formatMoney(account.transferredIn, (account.default_currency || primary).toUpperCase())} in`}
              {account.transferredOut > 0 &&
                `${account.spent > 0 || account.transferredIn > 0 ? " · " : ""}${formatMoney(account.transferredOut, (account.default_currency || primary).toUpperCase())} out`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default AccountBalances
