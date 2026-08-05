import { useEffect, useMemo, useState } from "react"
import AccountHistoryPanel from "../components/AccountHistoryPanel"
import ManageAccounts from "../components/ManageAccounts"
import StatCard from "../components/StatCard"
import { getAccountIcon, getAccountTypeLabel } from "../utils/accounts"
import {
  getAccountActivity,
  getTransactionsForAccount,
} from "../utils/accountStats"
import { formatMoney } from "../utils/transactionStats"

function Accounts({ accounts, transactions, fetchAccounts, loading }) {
  const [selectedId, setSelectedId] = useState(null)

  const activity = useMemo(
    () => getAccountActivity(accounts, transactions),
    [accounts, transactions]
  )

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null)
      return
    }
    const stillExists = accounts.some((a) => a.account_id === selectedId)
    if (!selectedId || !stillExists) {
      setSelectedId(accounts[0].account_id)
    }
  }, [accounts, selectedId])

  const totalBalance = activity.reduce((sum, a) => sum + a.balance, 0)
  const totalIncome = activity.reduce((sum, a) => sum + a.income, 0)
  const totalExpenses = activity.reduce((sum, a) => sum + a.spent, 0)

  const selectedAccount =
    activity.find((a) => a.account_id === selectedId) ?? null

  const accountTransactions = useMemo(() => {
    if (!selectedId) return []
    return getTransactionsForAccount(selectedId, transactions).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [selectedId, transactions])

  return (
    <div className="page accounts-page module-page">
      <div className="stat-grid stat-grid-4 kpi-grid">
        <StatCard
          icon="🏦"
          label="Accounts"
          value={String(accounts.length)}
          variant="balance"
        />
        <StatCard
          icon="📥"
          label="Total income"
          value={formatMoney(totalIncome)}
          variant="income"
        />
        <StatCard
          icon="📤"
          label="Total expenses"
          value={formatMoney(totalExpenses)}
          variant="expense"
        />
        <StatCard
          icon="⚖️"
          label="Combined balance"
          value={formatMoney(totalBalance)}
          variant="balance"
        />
      </div>

      <ManageAccounts
        accounts={accounts}
        transactions={transactions}
        onUpdate={fetchAccounts}
      />

      {accounts.length === 0 ? (
        <div className="card module-card section-card">
          <div className="empty-state">
            <span className="empty-icon">🏦</span>
            <p>No accounts yet</p>
            <span className="empty-hint">
              Add your bank, e-wallet, or cash accounts above to track balances
              and history per account.
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="accounts-layout">
            <div className="accounts-picker card module-card section-card">
              <div className="card-header">
                <h2>Your accounts</h2>
                <span className="chip muted-chip">Select to view history</span>
              </div>
              <div className="account-overview-grid accounts-picker-grid">
                {activity.map((account) => {
                  const isSelected = selectedId === account.account_id
                  return (
                    <button
                      key={account.account_id}
                      type="button"
                      className={`account-overview-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedId(account.account_id)}
                      aria-pressed={isSelected}
                    >
                      <div className="account-overview-head">
                        <span className="account-overview-icon">
                          {getAccountIcon(account.account_type)}
                        </span>
                        <div className="account-overview-title">
                          <span className="account-overview-name">
                            {account.name}
                          </span>
                          <span className="account-overview-type muted">
                            {getAccountTypeLabel(account.account_type)}
                          </span>
                        </div>
                      </div>
                      <p
                        className={`account-overview-balance ${account.balance >= 0 ? "positive" : "negative"}`}
                      >
                        {formatMoney(account.balance)}
                      </p>
                      <div className="account-overview-stats">
                        <span className="account-stat income">
                          <span className="account-stat-label">Income</span>
                          <span className="account-stat-value">
                            {formatMoney(account.income)}
                          </span>
                        </span>
                        <span className="account-stat expense">
                          <span className="account-stat-label">Expenses</span>
                          <span className="account-stat-value">
                            {formatMoney(account.spent)}
                          </span>
                        </span>
                      </div>
                      {(account.transferredIn > 0 ||
                        account.transferredOut > 0) && (
                        <p className="account-overview-transfers muted">
                          {account.transferredIn > 0 &&
                            `${formatMoney(account.transferredIn)} in`}
                          {account.transferredIn > 0 &&
                            account.transferredOut > 0 &&
                            " · "}
                          {account.transferredOut > 0 &&
                            `${formatMoney(account.transferredOut)} out`}
                        </p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <AccountHistoryPanel
              account={selectedAccount}
              transactions={accountTransactions}
              accounts={accounts}
              loading={loading}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default Accounts
