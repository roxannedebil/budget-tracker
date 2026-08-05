import { useMemo, useState } from "react"
import { getAccountIcon } from "../utils/accounts"
import { groupTransactionsByMonthLabel } from "../utils/accountStats"
import { formatCategoryLabel } from "../utils/categoryDisplay"
import { formatDisplayDate } from "../utils/formatDate"
import { formatMoney } from "../utils/transactionStats"

const TABS = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expenses" },
  { id: "transfer", label: "Transfers" },
]

function getTypeBadgeClass(type) {
  if (type === "expense") return "expense"
  if (type === "transfer") return "transfer"
  return "income"
}

function getAmountClass(type, accountId, t) {
  if (type === "expense") return "expense-text"
  if (type === "transfer") {
    return t.from_account_id === accountId ? "expense-text" : "income-text"
  }
  return "income-text"
}

function getAmountPrefix(type, accountId, t) {
  if (type === "expense") return "−"
  if (type === "transfer") {
    return t.from_account_id === accountId ? "−" : "+"
  }
  return "+"
}

function getTransferNote(t, accountId, accounts) {
  const otherId =
    t.from_account_id === accountId ? t.to_account_id : t.from_account_id
  const other = accounts.find((a) => a.account_id === otherId)
  const direction = t.from_account_id === accountId ? "To" : "From"
  return `${direction} ${other?.name ?? "account"}`
}

function AccountHistoryPanel({
  account,
  transactions,
  accounts,
  loading,
}) {
  const [tab, setTab] = useState("all")

  const filtered = useMemo(() => {
    if (tab === "all") return transactions
    if (tab === "income") return transactions.filter((t) => t.type === "income")
    if (tab === "expense") return transactions.filter((t) => t.type === "expense")
    return transactions.filter((t) => t.type === "transfer")
  }, [transactions, tab])

  const monthGroups = useMemo(
    () => groupTransactionsByMonthLabel(filtered),
    [filtered]
  )

  const tabCounts = useMemo(
    () => ({
      all: transactions.length,
      income: transactions.filter((t) => t.type === "income").length,
      expense: transactions.filter((t) => t.type === "expense").length,
      transfer: transactions.filter((t) => t.type === "transfer").length,
    }),
    [transactions]
  )

  if (!account) return null

  return (
    <div className="card module-card section-card account-history-panel">
      <div className="card-header account-history-header">
        <div>
          <h2>
            {getAccountIcon(account.account_type)} {account.name}
          </h2>
          <p className="account-history-subtitle muted">
            Transaction history for this account
          </p>
        </div>
        <span className="chip">{transactions.length} total</span>
      </div>

      <div className="account-detail-summary">
        <div className="account-detail-stat income">
          <span className="label">Income</span>
          <span className="value">{formatMoney(account.income)}</span>
        </div>
        <div className="account-detail-stat expense">
          <span className="label">Expenses</span>
          <span className="value">{formatMoney(account.spent)}</span>
        </div>
        <div className="account-detail-stat balance">
          <span className="label">Balance</span>
          <span className="value">{formatMoney(account.balance)}</span>
        </div>
      </div>

      <div className="history-tabs" role="tablist" aria-label="History filter">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`history-tab ${tab === item.id ? "active" : ""} ${item.id !== "all" && item.id !== "transfer" ? item.id : item.id === "transfer" ? "transfer" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            <span className="history-tab-count">{tabCounts[item.id]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="muted compact-hint">Loading history…</p>
      ) : filtered.length === 0 ? (
        <div className="account-history-empty">
          <span className="empty-icon">📋</span>
          <p>No {tab === "all" ? "" : `${tab} `}transactions yet</p>
          <span className="empty-hint">
            Income and expenses linked to this account will show up here.
          </span>
        </div>
      ) : (
        <div className="account-history-scroll">
          {monthGroups.map((group) => (
            <section key={group.key} className="history-month-group">
              <h3 className="history-month-label">{group.label}</h3>
              <div className="table-wrap history-table-wrap">
                <table className="transaction-table account-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Notes</th>
                      <th>Type</th>
                      <th className="col-amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((t) => (
                      <tr key={t.transaction_id ?? t.id}>
                        <td className="col-date">
                          {formatDisplayDate(t.date)}
                        </td>
                        <td className="col-category">
                          {formatCategoryLabel(t.category, t.subcategory) ||
                            (t.type === "transfer" ? "Transfer" : "—")}
                        </td>
                        <td className="col-notes">
                          {t.type === "transfer"
                            ? getTransferNote(t, account.account_id, accounts)
                            : t.notes || "—"}
                        </td>
                        <td>
                          <span
                            className={`badge ${getTypeBadgeClass(t.type)}`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td
                          className={`col-amount amount ${getAmountClass(t.type, account.account_id, t)}`}
                        >
                          {getAmountPrefix(t.type, account.account_id, t)}₱
                          {Number(t.amount).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default AccountHistoryPanel
