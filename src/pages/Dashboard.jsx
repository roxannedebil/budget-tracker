import { useEffect, useMemo, useState } from "react"
import { getMonthTransactions } from "../utils/transactionStats"
import {
  getDominantExpenseCurrency,
  getDailyExpenses,
  getExpenseBreakdown,
  getTopSpendingCategories,
} from "../utils/analytics"
import { colorAt } from "../utils/chartColors"
import StatCard from "../components/StatCard"
import Icon from "../components/icons/Icons"
import ChartCard from "../components/ChartCard"
import ExpenseDonutChart from "../components/charts/ExpenseDonutChart"
import DailySpendingLineChart from "../components/charts/DailySpendingLineChart"
import HorizontalCategoryBarChart from "../components/charts/HorizontalCategoryBarChart"
import RecentTransactionsTable from "../components/RecentTransactionsTable"
import LoadingState from "../components/LoadingState"
import EmptyState from "../components/EmptyState"
import CurrencyTotalsLines from "../components/CurrencyTotalsLines"
import ConvertedAmountDisplay from "../components/ConvertedAmountDisplay"
import { useCurrency } from "../context/CurrencyContext"
import { formatCurrency } from "../utils/currency"
import { summarizeMonthTotals } from "../utils/monthByCurrency"
import {
  isCurrentMonth,
  readDashboardMonth,
  writeDashboardMonth,
} from "../utils/dashboardMonth"
import { summarizeMonthInPrimary, netWorthInPrimaryDetailed } from "../utils/fxTotals"
import { netWorthSecondaryLines, sumBalancesByCurrency } from "../utils/netWorth"
import { userUsesConvertedTotals } from "../utils/userSettings"

function Dashboard({ transactions, accounts, profile, loading, onUpdated }) {
  const { primary, secondaries, ratesTable, ratesMeta } = useCurrency()
  const now = new Date()
  const [viewYear, setViewYear] = useState(() => {
    const saved = readDashboardMonth()
    return saved?.year ?? now.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const saved = readDashboardMonth()
    return saved?.month ?? now.getMonth()
  })

  useEffect(() => {
    writeDashboardMonth(viewYear, viewMonth)
  }, [viewYear, viewMonth])

  const atCurrentMonth = isCurrentMonth(viewYear, viewMonth)

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  })

  const shiftMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const monthTx = useMemo(
    () => getMonthTransactions(transactions, viewYear, viewMonth),
    [transactions, viewYear, viewMonth]
  )

  const monthByCurrency = useMemo(
    () => summarizeMonthTotals(monthTx),
    [monthTx]
  )

  const expenseBreakdown = useMemo(
    () => getExpenseBreakdown(monthTx),
    [monthTx]
  )

  const chartCurrency = useMemo(
    () => getDominantExpenseCurrency(monthTx),
    [monthTx]
  )

  const dailySpending = useMemo(
    () => getDailyExpenses(monthTx, viewYear, viewMonth, chartCurrency),
    [monthTx, viewYear, viewMonth, chartCurrency]
  )

  const topCategories = useMemo(
    () => getTopSpendingCategories(monthTx, 10),
    [monthTx]
  )

  const donutData = useMemo(() => {
    if (!chartCurrency) return expenseBreakdown
    return expenseBreakdown.filter((r) => r.currency === chartCurrency)
  }, [expenseBreakdown, chartCurrency])

  const barData = useMemo(
    () =>
      topCategories.map((r) => ({
        ...r,
        category:
          r.currency && topCategories.some((x) => x.category === r.category && x.currency !== r.currency)
            ? `${r.category} (${r.currency})`
            : r.category,
      })),
    [topCategories]
  )

  const totalsByCurrency = useMemo(
    () => sumBalancesByCurrency(accounts, transactions),
    [accounts, transactions]
  )

  const netWorthNativeLines = useMemo(
    () =>
      Object.entries(totalsByCurrency)
        .filter(([, major]) => major !== 0)
        .map(([currency, total]) => ({ currency, total }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    [totalsByCurrency]
  )

  const showConvertedTotals = useMemo(
    () => userUsesConvertedTotals(accounts, transactions, primary),
    [accounts, transactions, primary]
  )

  const netWorthPrimary = useMemo(
    () => netWorthInPrimaryDetailed(totalsByCurrency, primary, ratesTable),
    [totalsByCurrency, primary, ratesTable]
  )

  const netWorthSecondary = useMemo(
    () =>
      showConvertedTotals
        ? netWorthSecondaryLines(totalsByCurrency, primary, secondaries, ratesTable)
        : [],
    [totalsByCurrency, primary, secondaries, ratesTable, showConvertedTotals]
  )

  const monthPrimary = useMemo(
    () =>
      showConvertedTotals
        ? summarizeMonthInPrimary(monthTx, primary, ratesTable)
        : null,
    [monthTx, primary, ratesTable, showConvertedTotals]
  )

  if (loading) {
    return <LoadingState message="Loading dashboard…" />
  }

  return (
    <div className="page dashboard-page module-page">
      <header className="dashboard-hero module-card">
        <div className="dashboard-hero-main">
          <div className="dashboard-month-nav">
            <button
              type="button"
              className="btn-sm ghost dashboard-month-btn"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="dashboard-hero-badge">{monthLabel}</span>
            <button
              type="button"
              className="btn-sm ghost dashboard-month-btn"
              onClick={() => shiftMonth(1)}
              disabled={atCurrentMonth}
              aria-label="Next month"
            >
              →
            </button>
          </div>
          <p className="dashboard-hero-label">Net savings · {monthLabel}</p>
          <div className="dashboard-hero-value">
            {showConvertedTotals && monthPrimary ? (
              <ConvertedAmountDisplay
                primary={primary}
                total={monthPrimary.net}
                missingRates={monthPrimary.missingRates}
                className={
                  monthPrimary.net >= 0 ? "positive" : "negative"
                }
                valueClassName={`currency-total-line ${
                  monthPrimary.net >= 0 ? "positive" : "negative"
                }`}
              />
            ) : (
              <CurrencyTotalsLines
                rows={monthByCurrency}
                pick={(r) => r.net}
                emptyCurrency={primary}
                className={
                  monthByCurrency.some((r) => r.net >= 0) ? "positive" : "negative"
                }
              />
            )}
          </div>
          <p className="dashboard-hero-meta dashboard-hero-meta-currencies">
            {showConvertedTotals && monthPrimary ? (
              <>
                <ConvertedAmountDisplay
                  primary={primary}
                  total={monthPrimary.income}
                  missingRates={[]}
                  valueClassName="currency-total-line"
                />{" "}
                income ·{" "}
                <ConvertedAmountDisplay
                  primary={primary}
                  total={monthPrimary.expense}
                  missingRates={[]}
                  valueClassName="currency-total-line"
                />{" "}
                spent
                {monthPrimary.missingRates.length > 0 && (
                  <>
                    {" "}
                    ·{" "}
                    <ConvertedAmountDisplay
                      primary={primary}
                      total={null}
                      missingRates={monthPrimary.missingRates}
                      valueClassName="currency-total-line fx-no-rate"
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.income} emptyCurrency={primary} />{" "}
                income ·{" "}
                <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.expense} emptyCurrency={primary} />{" "}
                spent
              </>
            )}
          </p>
          {showConvertedTotals && monthByCurrency.length > 1 && (
            <details className="dashboard-native-breakdown muted">
                    <summary>Native amounts, no conversion</summary>
              <p className="dashboard-hero-meta dashboard-hero-meta-currencies">
                <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.net} emptyCurrency={primary} /> net ·{" "}
                <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.income} emptyCurrency={primary} />{" "}
                in ·{" "}
                <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.expense} emptyCurrency={primary} />{" "}
                out
              </p>
            </details>
          )}
          <p className="dashboard-hero-meta muted dashboard-fx-hint">
            {showConvertedTotals
              ? `Totals combine into ${primary}${
                  ratesMeta.loading ? " · loading rates…" : ""
                }. Stored amounts are never rewritten.`
              : "Native amounts, no conversion."}
            {ratesMeta?.source && !ratesMeta.loading && (
              <>
                {" "}
                Rates from {ratesMeta.source}
                {ratesMeta.fetchedAt
                  ? ` · updated ${new Date(ratesMeta.fetchedAt).toLocaleString()}`
                  : ""}
                .
              </>
            )}
          </p>
        </div>
        <div className="dashboard-hero-stats">
          <div className="dashboard-hero-stat dashboard-net-worth-stat">
            <span className="dashboard-hero-stat-label">
              Net worth · as of now{showConvertedTotals ? ` · ${primary}` : ""}
            </span>
            {netWorthNativeLines.length === 0 ? (
              <span className="dashboard-hero-stat-value">—</span>
            ) : showConvertedTotals ? (
              <>
                <ConvertedAmountDisplay
                  primary={primary}
                  total={netWorthPrimary.total}
                  missingRates={netWorthPrimary.missingRates}
                />
                {netWorthSecondary.map((line) => (
                  <span
                    key={line.currency}
                    className="dashboard-hero-stat-value dashboard-net-worth-secondary"
                  >
                    ≈ {formatCurrency(line.total, line.currency)}
                  </span>
                ))}
                {netWorthNativeLines.length > 1 && (
                  <details className="dashboard-native-breakdown muted">
                    <summary>Native balances</summary>
                    <div className="dashboard-net-worth-native">
                      {netWorthNativeLines.map((line) => (
                        <span key={line.currency} className="dashboard-hero-stat-value">
                          {formatCurrency(line.total, line.currency)}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
              </>
            ) : (
              netWorthNativeLines.map((line) => (
                <span key={line.currency} className="dashboard-hero-stat-value">
                  {formatCurrency(line.total, line.currency)}
                </span>
              ))
            )}
          </div>
          <div className="dashboard-hero-stat">
            <span className="dashboard-hero-stat-label">Transactions</span>
            <span className="dashboard-hero-stat-value">{monthTx.length}</span>
          </div>
          <div className="dashboard-hero-stat">
            <span className="dashboard-hero-stat-label">Categories</span>
            <span className="dashboard-hero-stat-value">
              {expenseBreakdown.length}
            </span>
          </div>
        </div>
      </header>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Overview</h2>
        <div className="stat-grid stat-grid-4 kpi-grid">
          <StatCard
            icon={<Icon name="income" size={20} />}
            label="Income"
            value={
              <CurrencyTotalsLines
                rows={monthByCurrency}
                pick={(r) => r.income}
                stacked
              />
            }
            variant="income"
            hint="Per currency"
          />
          <StatCard
            icon={<Icon name="expense" size={20} />}
            label="Expenses"
            value={
              <CurrencyTotalsLines
                rows={monthByCurrency}
                pick={(r) => r.expense}
                stacked
              />
            }
            variant="expense"
            hint="Per currency"
          />
          <StatCard
            icon={<Icon name="wallet" size={20} />}
            label="Net savings"
            value={
              <CurrencyTotalsLines rows={monthByCurrency} pick={(r) => r.net} stacked />
            }
            variant="income"
            hint="Per currency (not combined)"
          />
          <StatCard
            icon={<Icon name="receipt" size={20} />}
            label="Transactions"
            value={String(monthTx.length)}
            variant="balance"
            hint={atCurrentMonth ? "This month" : monthLabel}
          />
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Analytics</h2>
        <div className="dashboard-charts-grid">
          <ChartCard
            title="Expense breakdown"
            subtitle={
              chartCurrency
                ? `By category · ${chartCurrency} (largest expense currency)`
                : "Where your money went"
            }
            className="chart-span-2 module-card"
          >
            {expenseBreakdown.length === 0 ? (
              <EmptyState
                icon={<Icon name="pie-chart" size={32} />}
                title="No expenses this month"
                message="Add a transaction with a category to see your breakdown."
              />
            ) : (
              <div className="breakdown-layout">
                <ExpenseDonutChart data={donutData} />
                <ul className="breakdown-table">
                  {expenseBreakdown.map((row, i) => {
                    const subHint = row.subcategories?.length
                      ? row.subcategories
                          .map(
                            (s) =>
                              `${s.subcategory}: ${formatCurrency(s.total, s.currency)}`
                          )
                          .join(" · ")
                      : undefined

                    return (
                      <li
                        key={`${row.category}-${row.currency}`}
                        title={subHint}
                      >
                        <span className="breakdown-cat">
                          <span
                            className="breakdown-dot"
                            style={{ background: colorAt(i) }}
                          />
                          {row.category}
                          {row.currency ? (
                            <span className="muted breakdown-cur"> {row.currency}</span>
                          ) : null}
                        </span>
                        <span className="breakdown-amount expense-text">
                          {formatCurrency(row.amount, row.currency)}
                        </span>
                        <span className="breakdown-pct">
                          {row.percentage.toFixed(1)}%
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Daily spending"
            subtitle={
              chartCurrency
                ? `${chartCurrency} expenses by day`
                : "Expense trend by day"
            }
            className="module-card"
          >
            <DailySpendingLineChart data={dailySpending} currencyCode={chartCurrency} />
          </ChartCard>

          <ChartCard
            title="Top categories"
            subtitle="Highest spend first"
            className="module-card"
          >
            <HorizontalCategoryBarChart data={barData} currencyCode={chartCurrency} />
          </ChartCard>
        </div>
      </section>

      <section className="dashboard-section">
        <ChartCard
          title="Recent transactions"
          subtitle={`Latest 10 · ${monthLabel}`}
          className="module-card"
        >
          <RecentTransactionsTable
            transactions={monthTx}
            allTransactions={transactions}
            accounts={accounts}
            profile={profile}
            limit={10}
            onUpdated={onUpdated}
          />
        </ChartCard>
      </section>
    </div>
  )
}

export default Dashboard
