import { useEffect, useMemo, useState } from "react"
import LoadingState from "../components/LoadingState"
import StatCard from "../components/StatCard"
import TransactionDetailModal from "../components/TransactionDetailModal"
import Icon from "../components/icons/Icons"
import {
  buildCalendarGrid,
  formatDayHeading,
  getTodayKey,
  isSameDayKey,
  summarizeTransactionsByDay,
} from "../utils/calendarStats"
import { formatTransactionAmount } from "../utils/currency"
import {
  getTransactionAmountPrefix,
  getTransactionCategoryCell,
  getTypeAmountClass,
  getTypeLabel,
  getTypePillClass,
} from "../utils/transactionDisplay"
import { AccountsCell } from "../components/AccountLabel"
import { filterByMonth } from "../utils/transactionStats"
import {
  summarizeByCurrency,
  summarizeTransfersByCurrency,
} from "../utils/monthByCurrency"
import CurrencyTotalsLines from "../components/CurrencyTotalsLines"
import { formatCurrencyList } from "../utils/monthByCurrency"

function Calendar({ transactions, accounts = [], loading }) {
  const todayKey = getTodayKey()
  const today = new Date()

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey)
  const [detailTransaction, setDetailTransaction] = useState(null)

  const monthTransactions = useMemo(
    () => filterByMonth(transactions, viewYear, viewMonth),
    [transactions, viewYear, viewMonth]
  )

  const monthByCurrency = useMemo(
    () => summarizeByCurrency(monthTransactions),
    [monthTransactions]
  )

  const transfersByCurrency = useMemo(
    () => summarizeTransfersByCurrency(monthTransactions),
    [monthTransactions]
  )

  const daySummaries = useMemo(
    () => summarizeTransactionsByDay(transactions),
    [transactions]
  )

  const grid = useMemo(
    () => buildCalendarGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  useEffect(() => {
    const prefix = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-`
    if (selectedDayKey && !selectedDayKey.startsWith(prefix)) {
      setSelectedDayKey(null)
    }
  }, [viewYear, viewMonth, selectedDayKey])

  const selectedSummary = selectedDayKey ? daySummaries[selectedDayKey] : null

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const goToday = () => {
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    setSelectedDayKey(todayKey)
  }

  if (loading) {
    return <LoadingState message="Loading calendar…" />
  }

  return (
    <div className="page calendar-page module-page">
      <div className="stat-grid stat-grid-4 kpi-grid calendar-kpi-grid">
        <StatCard
          icon={<Icon name="income" size={20} />}
          label="Income this month"
          value={
            <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.income} stacked />
          }
          variant="income"
          hint="Per currency"
        />
        <StatCard
          icon={<Icon name="expense" size={20} />}
          label="Spent this month"
          value={
            <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.expense} stacked />
          }
          variant="expense"
          hint="Per currency"
        />
        <StatCard
          icon={<Icon name="transfer" size={20} />}
          label="Transfers this month"
          value={
            <CurrencyTotalsLines
              rows={transfersByCurrency}
              pick={(r) => r.total}
              stacked
            />
          }
          variant="transfer"
          hint="Send volume per currency"
        />
        <StatCard
          icon={<Icon name="wallet" size={20} />}
          label="Net this month"
          value={
            <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.net} stacked />
          }
          variant="income"
          hint="Income minus expenses, per currency"
        />
      </div>

      <div className="calendar-layout calendar-layout-swapped">
        <aside className="card module-card calendar-day-panel">
          <div className="calendar-day-panel-head">
            <div>
              <h2 className="calendar-day-panel-title">
                {formatDayHeading(selectedDayKey)}
              </h2>
              {selectedSummary ? (
                <p className="muted calendar-day-panel-meta">
                  {selectedSummary.count} transaction
                  {selectedSummary.count !== 1 ? "s" : ""}
                </p>
              ) : (
                <p className="muted calendar-day-panel-meta">
                  Click a day on the calendar to see details
                </p>
              )}
            </div>
            {selectedDayKey && (
              <button
                type="button"
                className="link-btn"
                onClick={() => setSelectedDayKey(null)}
              >
                Clear
              </button>
            )}
          </div>

          {selectedSummary && (
            <div className="calendar-day-summary-row">
              <div className="calendar-day-stat income">
                <span className="label">Income</span>
                <span className="value income-text">
                  <CurrencyTotalsLines
                    rows={summarizeByCurrency(selectedSummary.items)}
                    pick={(r) => r.income}
                    stacked
                  />
                </span>
              </div>
              <div className="calendar-day-stat expense">
                <span className="label">Spent</span>
                <span className="value expense-text">
                  <CurrencyTotalsLines
                    rows={summarizeByCurrency(selectedSummary.items)}
                    pick={(r) => r.expense}
                    stacked
                  />
                </span>
              </div>
              <div className="calendar-day-stat transfer">
                <span className="label">Transfers</span>
                <span className="value transfer-text">
                  <CurrencyTotalsLines
                    rows={summarizeTransfersByCurrency(selectedSummary.items)}
                    pick={(r) => r.total}
                    stacked
                  />
                </span>
              </div>
            </div>
          )}

          {!selectedDayKey && (
            <div className="calendar-day-empty">
              <Icon name="calendar" size={32} />
              <p>Select a day to view income, spending, and transfers.</p>
            </div>
          )}

          {selectedDayKey && !selectedSummary && (
            <div className="calendar-day-empty">
              <Icon name="inbox" size={32} />
              <p>No transactions on this day.</p>
            </div>
          )}

          {selectedSummary && (
            <>
              <div className="calendar-tx-list-head" aria-hidden="true">
                <span>Type</span>
                <span>Accounts</span>
                <span>Category</span>
                <span className="calendar-tx-head-amount">Amount</span>
                <span className="calendar-tx-head-action" />
              </div>
              <ul className="calendar-tx-list accounts-scroll">
                {selectedSummary.items.map((t) => {
                  const category = getTransactionCategoryCell(t, accounts, {
                    allTransactions: transactions,
                  })
                  const amountClass = getTypeAmountClass(t.type)
                  const prefix = getTransactionAmountPrefix(t.type, {
                    transaction: t,
                  })
                  return (
                    <li key={t.transaction_id ?? t.id} className="calendar-tx-item">
                      <span className="calendar-tx-col calendar-tx-col-type">
                        <span
                          className={`type-pill type-${getTypePillClass(t.type)}`}
                        >
                          {getTypeLabel(t)}
                        </span>
                      </span>
                      <span className="calendar-tx-col calendar-tx-col-accounts">
                        <AccountsCell
                          t={t}
                          accounts={accounts}
                          allTransactions={transactions}
                        />
                      </span>
                      <span
                        className="calendar-tx-col calendar-tx-col-category"
                        title={category || undefined}
                      >
                        {category || "—"}
                      </span>
                      <span
                        className={`calendar-tx-col calendar-tx-col-amount calendar-tx-amount ${amountClass}`}
                      >
                        {prefix}
                        {formatTransactionAmount(t)}
                      </span>
                      <button
                        type="button"
                        className="calendar-tx-view-btn"
                        onClick={() => setDetailTransaction(t)}
                        title="View full details"
                        aria-label={`View details for ${getTypeLabel(t)}`}
                      >
                        <Icon name="eye" size={16} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </aside>

        <section className="card module-card calendar-card">
          <div className="calendar-toolbar">
            <button
              type="button"
              className="btn-sm ghost calendar-nav-btn"
              onClick={goPrevMonth}
              aria-label="Previous month"
            >
              <Icon name="arrow-left" size={16} />
            </button>
            <div className="calendar-toolbar-center">
              <h2 className="calendar-month-title">{grid.monthLabel}</h2>
              <button type="button" className="link-btn calendar-today-btn" onClick={goToday}>
                Today
              </button>
            </div>
            <button
              type="button"
              className="btn-sm ghost calendar-nav-btn"
              onClick={goNextMonth}
              aria-label="Next month"
            >
              <Icon name="arrow-right" size={16} />
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {grid.weekdayLabels.map((label) => (
              <span key={label} className="calendar-weekday">
                {label}
              </span>
            ))}
          </div>

          <div className="calendar-grid" role="grid">
            {grid.cells.map((cell, index) => {
              if (cell.kind === "padding") {
                return (
                  <div
                    key={`pad-${index}`}
                    className="calendar-cell calendar-cell-padding"
                    aria-hidden="true"
                  />
                )
              }

              const summary = daySummaries[cell.key]
              const hasActivity = summary && summary.count > 0
              const isToday = isSameDayKey(cell.key, todayKey)
              const isSelected = isSameDayKey(cell.key, selectedDayKey)

              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`calendar-cell calendar-day ${hasActivity ? "has-activity" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedDayKey(cell.key)}
                  aria-pressed={isSelected}
                  aria-label={`${cell.day}${hasActivity ? `, ${summary.count} transactions` : ""}`}
                >
                  <span className="calendar-day-num">{cell.day}</span>
                  {hasActivity && (
                    <div className="calendar-day-totals">
                      {(() => {
                        const dayRows = summarizeByCurrency(summary.items)
                        const incomeText = formatCurrencyList(dayRows, (r) => r.income)
                        const expenseText = formatCurrencyList(dayRows, (r) => r.expense)
                        const transferRows = summarizeTransfersByCurrency(summary.items)
                        const transferText = formatCurrencyList(
                          transferRows,
                          (r) => r.total
                        )
                        return (
                          <>
                            {dayRows.some((r) => r.income > 0) && (
                              <span className="calendar-mini income-text" title={incomeText}>
                                +{incomeText}
                              </span>
                            )}
                            {dayRows.some((r) => r.expense > 0) && (
                              <span className="calendar-mini expense-text" title={expenseText}>
                                −{expenseText}
                              </span>
                            )}
                            {transferRows.some((r) => r.total > 0) && (
                              <span className="calendar-mini transfer-text" title={transferText}>
                                ⇄ {transferText}
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <TransactionDetailModal
        transaction={detailTransaction}
        accounts={accounts}
        allTransactions={transactions}
        onClose={() => setDetailTransaction(null)}
      />
    </div>
  )
}

export default Calendar
