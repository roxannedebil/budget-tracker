import { useMemo, useState } from "react"
import Icon from "./icons/Icons"
import { getAccountIcon, getAccountTypeLabel } from "../utils/accounts"
import { groupTransactionsByMonthLabel } from "../utils/accountStats"
import { formatCategoryLabel } from "../utils/categoryDisplay"
import { formatDisplayDate } from "../utils/formatDate"
import { formatMoney } from "../utils/transactionStats"
import TransactionDetailModal from "./TransactionDetailModal"

const TABS = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expenses" },
  { id: "transfer", label: "Transfers" },
]

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

function transferTotal(account) {
  return (Number(account.transferredIn) || 0) + (Number(account.transferredOut) || 0)
}

function AccountDetailHero({ account }) {
  return (
    <div className="accounts-detail-hero accounts-detail-hero-compact" aria-live="polite">
      <div className="accounts-detail-hero-row">
        <span className="accounts-detail-hero-icon" aria-hidden="true">
          <Icon name={getAccountIcon(account.account_type)} size={22} />
        </span>
        <div className="accounts-detail-hero-titles">
          <h2 className="accounts-detail-hero-name">{account.name}</h2>
          <p className="accounts-detail-hero-type muted">
            {getAccountTypeLabel(account.account_type)}
          </p>
        </div>
        <div className="accounts-detail-hero-balance-wrap">
          <span className="accounts-detail-hero-balance-label muted">Balance</span>
          <p
            className={`accounts-detail-hero-balance ${account.balance >= 0 ? "positive" : "negative"}`}
          >
            {formatMoney(account.balance)}
          </p>
        </div>
      </div>
      <dl className="accounts-detail-metrics">
        <div className="accounts-detail-metric income">
          <dt>Income</dt>
          <dd>{formatMoney(account.income)}</dd>
        </div>
        <div className="accounts-detail-metric expense">
          <dt>Expenses</dt>
          <dd>{formatMoney(account.spent)}</dd>
        </div>
        <div className="accounts-detail-metric transfer">
          <dt>Transfers</dt>
          <dd>{formatMoney(transferTotal(account))}</dd>
        </div>
      </dl>
    </div>
  )
}

function getTransferCategory(t, accountId, accounts) {
  const otherId =
    t.from_account_id === accountId ? t.to_account_id : t.from_account_id
  const other = accounts.find((a) => a.account_id === otherId)
  const direction = t.from_account_id === accountId ? "To" : "From"
  return `${direction} ${other?.name ?? "account"}`
}

function getCategoryCell(t, accountId, accounts) {
  if (t.type === "transfer") {
    return getTransferCategory(t, accountId, accounts)
  }
  return formatCategoryLabel(t.category, t.subcategory) || "—"
}

function AccountHistoryPanel({
  account,
  transactions,
  accounts,
  loading,
}) {
  const [tab, setTab] = useState("all")
  const [search, setSearch] = useState("")
  const [detailTransaction, setDetailTransaction] = useState(null)
  const accountId = account?.account_id ?? null

  const tabFiltered = useMemo(() => {
    if (tab === "all") return transactions
    if (tab === "income") return transactions.filter((t) => t.type === "income")
    if (tab === "expense") return transactions.filter((t) => t.type === "expense")
    return transactions.filter((t) => t.type === "transfer")
  }, [transactions, tab])

  const filtered = useMemo(() => {
    if (!accountId) return []
    const q = search.trim().toLowerCase()
    if (!q) return tabFiltered
    return tabFiltered.filter((t) => {
      const category = getCategoryCell(t, accountId, accounts)
      const notes = t.notes?.trim() || ""
      return (
        category.toLowerCase().includes(q) ||
        notes.toLowerCase().includes(q)
      )
    })
  }, [tabFiltered, search, accountId, accounts])

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
    <div className="card module-card accounts-account-detail accounts-history-panel">
      <AccountDetailHero account={account} />

      <div className="accounts-detail-body">
      <div className="accounts-history-toolbar accounts-detail-toolbar">
        <p className="accounts-detail-toolbar-heading">
          <span className="accounts-detail-toolbar-title">Transactions</span>
          <span className="accounts-detail-toolbar-count muted">
            {transactions.length} record{transactions.length === 1 ? "" : "s"}
          </span>
        </p>
        <div className="accounts-detail-toolbar-controls">
        <div
          className="accounts-history-segments"
          role="tablist"
          aria-label="History filter"
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`accounts-history-segment ${tab === item.id ? "active" : ""} ${
                item.id !== "all" ? item.id : ""
              }`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              <span className="accounts-history-segment-count">
                {tabCounts[item.id]}
              </span>
            </button>
          ))}
        </div>
        <label className="accounts-history-search">
          <span className="sr-only">Search notes or category</span>
          <input
            type="search"
            placeholder="Search category or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        </div>
      </div>

      <div className="accounts-detail-scroll-region">
      {loading ? (
        <p className="muted compact-hint accounts-detail-loading">Loading history…</p>
      ) : filtered.length === 0 ? (
        <div className="accounts-history-empty accounts-detail-empty">
          <span className="empty-icon">
            <Icon name="clipboard" size={28} />
          </span>
          <p>
            No {tab === "all" ? "" : `${tab} `}
            transactions{search.trim() ? " match your search" : " yet"}
          </p>
          <span className="empty-hint">
            Income, expenses, and transfers linked to this account appear here.
          </span>
        </div>
      ) : (
        <div className="accounts-history-scroll accounts-scroll">
          {monthGroups.map((group) => (
              <section key={group.key} className="accounts-history-month">
              <h3 className="accounts-history-month-label">{group.label}</h3>
              <div className="table-wrap accounts-history-table-wrap">
                <table className="transaction-table accounts-history-table">
                  <colgroup>
                    <col className="accounts-history-col-date" />
                    <col className="accounts-history-col-category" />
                    <col className="accounts-history-col-amount" />
                    <col className="accounts-history-col-action" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="col-date">Date</th>
                      <th className="col-category">Category</th>
                      <th className="col-amount">Amount</th>
                      <th className="col-action" aria-label="Details" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((t) => {
                      const category = getCategoryCell(
                        t,
                        account.account_id,
                        accounts
                      )
                      const amountClass = getAmountClass(
                        t.type,
                        account.account_id,
                        t
                      )
                      const prefix = getAmountPrefix(
                        t.type,
                        account.account_id,
                        t
                      )

                      return (
                        <tr key={t.transaction_id ?? t.id}>
                          <td className="col-date" data-label="Date">
                            {formatDisplayDate(t.date)}
                          </td>
                          <td
                            className="col-category"
                            data-label="Category"
                            title={category}
                          >
                            {category}
                          </td>
                          <td
                            className={`col-amount amount accounts-history-amount-cell ${amountClass}`}
                            data-label="Amount"
                          >
                            {prefix}
                            {formatMoney(t.amount)}
                          </td>
                          <td
                            className="col-action accounts-history-action-cell"
                            data-label="Details"
                          >
                            <button
                              type="button"
                              className="calendar-tx-view-btn accounts-history-view-btn"
                              onClick={() => setDetailTransaction(t)}
                              title="View notes and details"
                              aria-label={`View details for ${category}`}
                            >
                              <Icon name="eye" size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </section>
          ))}
        </div>
      )}
      </div>
      </div>

      <TransactionDetailModal
        transaction={detailTransaction}
        accounts={accounts}
        onClose={() => setDetailTransaction(null)}
      />
    </div>
  )
}

export default AccountHistoryPanel
