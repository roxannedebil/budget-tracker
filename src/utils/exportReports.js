import * as XLSX from "xlsx"
import { formatDisplayDate } from "./formatDate"
import { formatMoney } from "./transactionStats"
import { formatFilterDateRange } from "./reportFilters"

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function txRow(t) {
  return {
    Date: formatDisplayDate(t.date),
    Type: t.type,
    Category: t.category || "",
    Amount: Number(t.amount),
    Notes: t.notes || "",
  }
}

export function exportTransactionsCsv(transactions, filename = "transactions.csv") {
  const headers = ["Date", "Type", "Category", "Amount", "Notes"]
  const rows = transactions.map((t) => [
    formatDisplayDate(t.date),
    t.type,
    t.category || "",
    Number(t.amount),
    t.notes || "",
  ])

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")

  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), filename)
}

export function exportReportExcel({
  transactions,
  filters,
  summary,
  expenseByCategory,
  incomeByCategory,
  insights = [],
}) {
  const rangeLabel = formatFilterDateRange(filters)
  const stamp = new Date().toISOString().slice(0, 10)

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Budget Tracker Report"],
    ["Date range", rangeLabel],
    ["Generated", formatDisplayDate(new Date())],
    [],
    ["Metric", "Value"],
    ["Income", summary.income],
    ["Expenses", summary.expenses],
    ["Net savings", summary.net],
    ["Transactions", summary.count],
  ])

  const txSheet = XLSX.utils.json_to_sheet(transactions.map(txRow))

  const expenseSheet = XLSX.utils.aoa_to_sheet([
    ["Category", "Amount"],
    ...expenseByCategory.map((r) => [r.category, r.total]),
  ])

  const incomeSheet = XLSX.utils.aoa_to_sheet([
    ["Category", "Amount"],
    ...incomeByCategory.map((r) => [r.category, r.total]),
  ])

  const insightsSheet = XLSX.utils.aoa_to_sheet([
    ["Insight", "Value", "Detail"],
    ...insights.map((i) => [i.title, i.value, i.detail || ""]),
  ])

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")
  XLSX.utils.book_append_sheet(workbook, txSheet, "Transactions")
  XLSX.utils.book_append_sheet(workbook, expenseSheet, "Expenses")
  XLSX.utils.book_append_sheet(workbook, incomeSheet, "Income")
  XLSX.utils.book_append_sheet(workbook, insightsSheet, "Insights")

  XLSX.writeFile(workbook, `budget-report-${stamp}.xlsx`)
}

export function exportSummaryCsv({
  transactions,
  filters,
  summary,
  expenseByCategory,
  incomeByCategory,
}) {
  const lines = [
    `Budget Tracker Report`,
    `Date range,${formatFilterDateRange(filters)}`,
    ``,
    `Summary`,
    `Income,${summary.income}`,
    `Expenses,${summary.expenses}`,
    `Net,${summary.net}`,
    `Transactions,${summary.count}`,
    ``,
    `Expenses by category`,
    `Category,Amount`,
    ...expenseByCategory.map((r) => `${r.category},${r.total}`),
    ``,
    `Income by category`,
    `Category,Amount`,
    ...incomeByCategory.map((r) => `${r.category},${r.total}`),
    ``,
    `Transactions`,
    `Date,Type,Category,Amount,Notes`,
    ...transactions.map(
      (t) =>
        `${formatDisplayDate(t.date)},${t.type},${t.category || ""},${t.amount},"${(t.notes || "").replace(/"/g, '""')}"`
    ),
  ]

  downloadBlob(
    new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
    `budget-report-${new Date().toISOString().slice(0, 10)}.csv`
  )
}

export function formatSummaryForDisplay(summary) {
  return {
    income: formatMoney(summary.income),
    expenses: formatMoney(summary.expenses),
    net: formatMoney(summary.net),
    count: String(summary.count),
  }
}
