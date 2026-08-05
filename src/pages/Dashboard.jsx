import { useMemo } from "react"
import {
  getCurrentMonthTransactions,
  getExpenses,
  getIncome,
  getBalance,
  formatMoney,
} from "../utils/transactionStats"
import {
  getExpenseBreakdown,
  getDailyExpenses,
  getTopSpendingCategories,
} from "../utils/analytics"
import { colorAt } from "../utils/chartColors"
import StatCard from "../components/StatCard"
import ChartCard from "../components/ChartCard"
import ExpenseDonutChart from "../components/charts/ExpenseDonutChart"
import DailySpendingLineChart from "../components/charts/DailySpendingLineChart"
import HorizontalCategoryBarChart from "../components/charts/HorizontalCategoryBarChart"
import RecentTransactionsTable from "../components/RecentTransactionsTable"
import LoadingState from "../components/LoadingState"
import EmptyState from "../components/EmptyState"

function Dashboard({ transactions, loading }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const monthLabel = now.toLocaleString("default", {
    month: "long",
    year: "numeric",
  })

  const monthTx = useMemo(
    () => getCurrentMonthTransactions(transactions),
    [transactions]
  )

  const income = getIncome(monthTx)
  const expenses = getExpenses(monthTx)
  const savings = getBalance(monthTx)
  const savingsRate = income > 0 ? ((savings / income) * 100).toFixed(0) : null

  const expenseBreakdown = useMemo(
    () => getExpenseBreakdown(monthTx),
    [monthTx]
  )

  const dailySpending = useMemo(
    () => getDailyExpenses(monthTx, year, month),
    [monthTx, year, month]
  )

  const topCategories = useMemo(
    () => getTopSpendingCategories(monthTx),
    [monthTx]
  )

  if (loading) {
    return <LoadingState message="Loading dashboard…" />
  }

  return (
    <div className="page dashboard-page module-page">
      <header className="dashboard-hero module-card">
        <div className="dashboard-hero-main">
          <span className="dashboard-hero-badge">{monthLabel}</span>
          <p className="dashboard-hero-label">Net savings this month</p>
          <p
            className={`dashboard-hero-value ${savings >= 0 ? "positive" : "negative"}`}
          >
            {formatMoney(savings)}
          </p>
          <p className="dashboard-hero-meta">
            {formatMoney(income)} income · {formatMoney(expenses)} spent
            {savingsRate !== null && ` · ${savingsRate}% saved`}
          </p>
        </div>
        <div className="dashboard-hero-stats">
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
            icon="📥"
            label="Income"
            value={formatMoney(income)}
            variant="income"
          />
          <StatCard
            icon="📤"
            label="Expenses"
            value={formatMoney(expenses)}
            variant="expense"
          />
          <StatCard
            icon="💰"
            label="Net savings"
            value={formatMoney(savings)}
            variant={savings >= 0 ? "income" : "expense"}
            hint="Income minus expenses"
          />
          <StatCard
            icon="🧾"
            label="Transactions"
            value={String(monthTx.length)}
            variant="balance"
            hint="This month"
          />
        </div>
      </section>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Analytics</h2>
        <div className="dashboard-charts-grid">
          <ChartCard
            title="Expense breakdown"
            subtitle="Where your money went"
            className="chart-span-2 module-card"
          >
            {expenseBreakdown.length === 0 ? (
              <EmptyState
                icon="🍩"
                title="No expenses this month"
                message="Add a transaction with a category to see your breakdown."
              />
            ) : (
              <div className="breakdown-layout">
                <ExpenseDonutChart data={expenseBreakdown} />
                <ul className="breakdown-table">
                  {expenseBreakdown.map((row, i) => {
                    const subHint = row.subcategories?.length
                      ? row.subcategories
                          .map(
                            (s) =>
                              `${s.subcategory}: ${formatMoney(s.total)}`
                          )
                          .join(" · ")
                      : undefined

                    return (
                      <li key={row.category} title={subHint}>
                        <span className="breakdown-cat">
                          <span
                            className="breakdown-dot"
                            style={{ background: colorAt(i) }}
                          />
                          {row.category}
                        </span>
                        <span className="breakdown-amount expense-text">
                          {formatMoney(row.amount)}
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
            subtitle="Expense trend by day"
            className="module-card"
          >
            <DailySpendingLineChart data={dailySpending} />
          </ChartCard>

          <ChartCard
            title="Top categories"
            subtitle="Highest spend first"
            className="module-card"
          >
            <HorizontalCategoryBarChart data={topCategories} />
          </ChartCard>
        </div>
      </section>

      <section className="dashboard-section">
        <ChartCard
          title="Recent transactions"
          subtitle="Latest 10 this month"
          className="module-card"
        >
          <RecentTransactionsTable transactions={monthTx} limit={10} />
        </ChartCard>
      </section>
    </div>
  )
}

export default Dashboard
