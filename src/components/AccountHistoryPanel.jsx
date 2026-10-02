import { useMemo, useState } from "react"
import Icon from "./icons/Icons"
import { getAccountIcon, getAccountTypeLabel } from "../utils/accounts"
import { groupTransactionsByMonthLabel } from "../utils/accountStats"
import {
  getTransactionAmountPrefix,
  getTransactionCategoryCell,
  getTypeLabel,
  getTypePillClass,
  getNotesWithFeeContext,
} from "../utils/transactionDisplay"
import { isExpenseTransaction } from "../utils/transactionTypes"
import { formatDisplayDate } from "../utils/formatDate"
import { formatMoney } from "../utils/transactionStats"
import { useCurrency } from "../context/CurrencyContext"
import { formatTransactionAmount } from "../utils/currency"
import { isTransferLegForVolume } from "../utils/transactionTypes"
import AccountBalanceLines from "./AccountBalanceLines"
import { accountColorStyleVars } from "../utils/accountColor"
import { AccountColorDot } from "./AccountLabel"

const TABS = [
  { id: "all", label: "All" },
  { id: "income", label: "Income" },
  { id: "expense", label: "Expenses" },
  { id: "transfer", label: "Transfers" },
]

function getAmountClass(type, accountId, t) {
  if (type === "expense" || type === "fee") return "expense-text"
  if (type === "income") return "income-text"
  if (
    type === "transfer" ||
    type === "transfer_in" ||
    type === "transfer_out"
  ) {
    return "transfer-text"
  }
  return "income-text"
}

function transferTotal(account) {
  return (Number(account.transferredIn) || 0) + (Number(account.transferredOut) || 0)
}

function AccountDetailHero({ account }) {
  const { primary } = useCurrency()
  const summaryCurrency = (account.default_currency || primary).toUpperCase()
  return (
    <div
      className="accounts-detail-hero accounts-detail-hero-compact has-account-color"
      style={accountColorStyleVars(account)}
      aria-live="polite"
    >
      <div className="accounts-detail-hero-row">
        <span className="accounts-detail-hero-icon" aria-hidden="true">
          <Icon name={getAccountIcon(account.account_type)} size={22} />
        </span>
        <div className="accounts-detail-hero-titles">
          <h2 className="accounts-detail-hero-name">
            <AccountColorDot account={account} />
            {account.name}
          </h2>
          <p className="accounts-detail-hero-type muted">
            {getAccountTypeLabel(account.account_type)}
          </p>
        </div>
        <div className="accounts-detail-hero-balance-wrap">
          <span className="accounts-detail-hero-balance-label muted">Balance</span>
          <AccountBalanceLines
            account={account}
            valueClassName="accounts-detail-hero-balance"
          />
        </div>
      </div>
      <dl className="accounts-detail-metrics">
        <div className="accounts-detail-metric income">
          <dt>Income</dt>
          <dd>{formatMoney(account.income, summaryCurrency)}</dd>
        </div>
        <div className="accounts-detail-metric expense">
          <dt>Expenses</dt>
          <dd>{formatMoney(account.spent, summaryCurrency)}</dd>
        </div>
        <div className="accounts-detail-metric transfer">
          <dt>Transfers</dt>
          <dd>{formatMoney(transferTotal(account), summaryCurrency)}</dd>
        </div>
      </dl>
    </div>
  )
}

function AccountHistoryPanel({
  account,
  transactions,
  allTransactions,
  accounts,
  profile,
  loading,
  onUpdated,
}) {
  const [tab, setTab] = useState("all")
  const [search, setSearch] = useState("")
  const accountId = account?.account_id ?? null
  const txnCorpus = allTransactions ?? transactions

  const tabFiltered = useMemo(() => {
    if (tab === "all") return transactions
    if (tab === "income") return transactions.filter((t) => t.type === "income")
    if (tab === "expense") return transactions.filter((t) => isExpenseTransaction(t))
    return transactions.filter((t) => isTransferLegForVolume(t))
  }, [transactions, tab])

  const filtered = useMemo(() => {
    if (!accountId) return []
    const q = search.trim().toLowerCase()
    if (!q) return tabFiltered
    return tabFiltered.filter((t) => {
      const category = getTransactionCategoryCell(t, accounts, {
        accountId,
        allTransactions: allTransactions ?? transactions,
      })
      const notes = getNotesWithFeeContext(
        t,
        accounts,
        txnCorpus,
        accountId
      )
      return (
        category.toLowerCase().includes(q) ||
        notes.toLowerCase().includes(q)
      )
    })
  }, [tabFiltered, search, accountId, accounts, txnCorpus])

  const monthGroups = useMemo(
    () => groupTransactionsByMonthLabel(filtered),
    [filtered]
  )

  const tabCounts = useMemo(
    () => ({
      all: transactions.length,
      income: transactions.filter((t) => t.type === "income").length,
      expense: transactions.filter((t) => isExpenseTransaction(t)).length,
      transfer: transactions.filter((t) => isTransferLegForVolume(t)).length,
    }),
    [transactions]
  )

  if (!account) return null

  const showTypeColumn = tab === "all"

  return (
    <div
      className="card module-card accounts-account-detail accounts-history-panel has-account-color"
      style={accountColorStyleVars(account)}
    >
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
            Record income, expenses, or transfers for this account on the Transactions
            page. They will show up here automatically.
          </span>
        </div>
      ) : (
        <div className="accounts-history-scroll accounts-scroll">
          {monthGroups.map((group) => (
              <section key={group.key} className="accounts-history-month">
              <h3 className="accounts-history-month-label">{group.label}</h3>
              <div className="table-wrap accounts-history-table-wrap">
                <table
                  className={`transaction-table accounts-history-table${showTypeColumn ? " accounts-history-table-with-type" : ""}`}
                >
                  <colgroup>
                    <col className="accounts-history-col-date" />
                    {showTypeColumn && (
                      <col className="accounts-history-col-type" />
                    )}
                    <col className="accounts-history-col-category" />
                    <col className="accounts-history-col-notes" />
                    <col className="accounts-history-col-amount" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="col-date">Date</th>
                      {showTypeColumn && <th className="col-type">Type</th>}
                      <th className="col-category">Category</th>
                      <th className="col-notes">Notes</th>
                      <th className="col-amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((t) => {
                      const category = getTransactionCategoryCell(t, accounts, {
                        accountId: account.account_id,
                        allTransactions: allTransactions ?? transactions,
                      })
                      const amountClass = getAmountClass(
                        t.type,
                        account.account_id,
                        t
                      )
                      const prefix = getTransactionAmountPrefix(t.type, {
                        accountId: account.account_id,
                        transaction: t,
                      })

                      return (
                        <tr key={t.transaction_id ?? t.id}>
                          <td className="col-date" data-label="Date">
                            {formatDisplayDate(t.date)}
                          </td>
                          {showTypeColumn && (
                            <td className="col-type" data-label="Type">
                              <span
                                className={`type-pill type-${getTypePillClass(t.type)}`}
                              >
                                {getTypeLabel(t, account.account_id)}
                              </span>
                            </td>
                          )}
                          <td
                            className="col-category"
                            data-label="Category"
                            title={category}
                          >
                            {category}
                          </td>
                          <td
                            className="col-notes"
                            data-label="Notes"
                            title={getNotesWithFeeContext(
                              t,
                              accounts,
                              txnCorpus,
                              account.account_id
                            )}
                          >
                            {getNotesWithFeeContext(
                              t,
                              accounts,
                              txnCorpus,
                              account.account_id
                            )}
                          </td>
                          <td
                            className={`col-amount amount accounts-history-amount-cell ${amountClass}`}
                            data-label="Amount"
                          >
                            {prefix}
                            {formatTransactionAmount(t)}
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

    </div>
  )
}

export default AccountHistoryPanel
