import { useMemo, useState } from "react"
import {
  getCashFlowTrend,
  getFinancialInsights,
  getMonthComparison,
  getMonthlyIncomeExpense,
  getReportCategories,
  groupExpensesByCategory,
  groupIncomeByCategory,
} from "../utils/analytics"
import {
  filterReportTransactions,
  formatFilterDateRange,
  getDefaultReportFilters,
} from "../utils/reportFilters"
import {
  exportReportExcel,
  exportSummaryCsv,
  exportTransactionsCsv,
} from "../utils/exportReports"
import CurrencyTotalsLines from "../components/CurrencyTotalsLines"
import { summarizeByCurrency } from "../utils/monthByCurrency"
import ChartCard from "../components/ChartCard"
import MonthlyIncomeExpenseChart from "../components/charts/MonthlyIncomeExpenseChart"
import CashFlowLineChart from "../components/charts/CashFlowLineChart"
import CategoryPieChart from "../components/charts/CategoryPieChart"
import ReportFilters from "../components/reports/ReportFilters"
import ComparisonCards from "../components/reports/ComparisonCards"
import InsightsPanel from "../components/reports/InsightsPanel"
import LoadingState from "../components/LoadingState"
import StatCard from "../components/StatCard"
import Icon from "../components/icons/Icons"
import { useCurrency } from "../context/CurrencyContext"

function Reports({ transactions, loading }) {
  const { primary } = useCurrency()
  const [filters, setFilters] = useState(getDefaultReportFilters)

  const filtered = useMemo(
    () => filterReportTransactions(transactions, filters),
    [transactions, filters]
  )

  const categories = useMemo(
    () => getReportCategories(transactions).all,
    [transactions]
  )

  const byCurrency = useMemo(
    () => summarizeByCurrency(filtered),
    [filtered]
  )

  const summary = useMemo(
    () => ({
      byCurrency,
      count: filtered.length,
    }),
    [byCurrency, filtered.length]
  )

  const monthlyData = useMemo(
    () => getMonthlyIncomeExpense(filtered),
    [filtered]
  )

  const cashFlow = useMemo(() => getCashFlowTrend(filtered), [filtered])

  const expenseByCategory = useMemo(
    () => groupExpensesByCategory(filtered),
    [filtered]
  )

  const incomeByCategory = useMemo(
    () => groupIncomeByCategory(filtered),
    [filtered]
  )

  const expenseChartData = useMemo(
    () =>
      expenseByCategory.map((r) => ({
        ...r,
        category:
          expenseByCategory.filter((x) => x.category === r.category).length > 1
            ? `${r.category} (${r.currency})`
            : r.category,
      })),
    [expenseByCategory]
  )

  const incomeChartData = useMemo(
    () =>
      incomeByCategory.map((r) => ({
        ...r,
        category:
          incomeByCategory.filter((x) => x.category === r.category).length > 1
            ? `${r.category} (${r.currency})`
            : r.category,
      })),
    [incomeByCategory]
  )

  const comparison = useMemo(
    () => getMonthComparison(transactions),
    [transactions]
  )

  const insights = useMemo(
    () => getFinancialInsights(filtered, primary),
    [filtered, primary]
  )

  const exportPayload = {
    transactions: filtered,
    filters,
    summary,
    expenseByCategory,
    incomeByCategory,
    insights,
  }

  if (loading) {
    return <LoadingState message="Loading reports…" />
  }

  return (
    <div className="page reports-page module-page">
      <ReportFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        onExportExcel={() => exportReportExcel(exportPayload)}
        onExportCsv={() => exportSummaryCsv(exportPayload)}
        onExportTransactions={() =>
          exportTransactionsCsv(filtered, "filtered-transactions.csv")
        }
      />

      <section className="reports-section">
        <div className="reports-section-head">
          <h2 className="reports-section-title">Summary</h2>
          <p className="reports-section-subtitle muted">
            {formatFilterDateRange(filters)}
            {filtered.length > 0 && ` · ${filtered.length} transactions`}
          </p>
        </div>
        <div className="stat-grid stat-grid-4 kpi-grid">
          <StatCard
            icon={<Icon name="income" size={20} />}
            label="Income"
            value={
              <CurrencyTotalsLines rows={byCurrency} pick={(r) => r.income} stacked />
            }
            variant="income"
            hint="Per currency"
          />
          <StatCard
            icon={<Icon name="expense" size={20} />}
            label="Expenses"
            value={
              <CurrencyTotalsLines rows={byCurrency} pick={(r) => r.expense} stacked />
            }
            variant="expense"
            hint="Per currency"
          />
          <StatCard
            icon={<Icon name="wallet" size={20} />}
            label="Net savings"
            value={
              <CurrencyTotalsLines rows={byCurrency} pick={(r) => r.net} stacked />
            }
            variant="income"
            hint="Per currency"
          />
          <StatCard
            icon={<Icon name="receipt" size={20} />}
            label="Transactions"
            value={String(filtered.length)}
            variant="balance"
          />
        </div>
      </section>

      <ComparisonCards comparison={comparison} />

      <section className="reports-section">
        <div className="reports-section-head">
          <h2 className="reports-section-title">Charts</h2>
          <p className="reports-section-subtitle muted">
            Visual breakdown for selected period
          </p>
        </div>
        <div className="reports-charts-grid">
          <ChartCard
            title="Income vs expenses"
            subtitle="Monthly totals"
            className="chart-span-2 module-card"
          >
            <MonthlyIncomeExpenseChart data={monthlyData} currencyCode={primary} />
          </ChartCard>

          <ChartCard
            title="Cash flow"
            subtitle="Running balance"
            className="chart-span-2 module-card"
          >
            <CashFlowLineChart data={cashFlow} currencyCode={primary} />
          </ChartCard>

          <ChartCard
            title="Expenses by category"
            className="module-card"
          >
            <CategoryPieChart
              data={expenseChartData}
              emptyTitle="No expenses"
              emptyMessage="Adjust filters or add expense transactions."
            />
          </ChartCard>

          <ChartCard title="Income by category" className="module-card">
            <CategoryPieChart
              data={incomeChartData}
              emptyTitle="No income"
              emptyMessage="Adjust filters or add income transactions."
            />
          </ChartCard>
        </div>
      </section>

      <InsightsPanel insights={insights} />
    </div>
  )
}

export default Reports
