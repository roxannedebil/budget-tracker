import { formatDisplayDate } from "./formatDate"
import { getReportCategoryOptions } from "./categories"
import {
  getTransactionCurrency,
  getTransactionMajorAbs,
} from "./currency"
import {
  filterByMonth,
  formatMoney,
  getBalance,
  getExpenses,
  getIncome,
  groupByMonth,
} from "./transactionStats"
import { isExpenseTransaction } from "./transactionTypes"
import { summarizeByCurrency } from "./monthByCurrency"

function groupByCategoryWithSubs(transactions, type) {
  const groups = {}

  transactions
    .filter((t) => (type === "expense" ? isExpenseTransaction(t) : t.type === type))
    .forEach((t) => {
      const cat = (t.category || "Uncategorized").trim() || "Uncategorized"
      const sub = (t.subcategory || "").trim()
      const cur = getTransactionCurrency(t)
      const key = `${cat}|${cur}`
      const amt = getTransactionMajorAbs(t)

      if (!groups[key]) {
        groups[key] = {
          category: cat,
          currency: cur,
          total: 0,
          subcategories: {},
        }
      }
      groups[key].total += amt

      if (sub) {
        groups[key].subcategories[sub] =
          (groups[key].subcategories[sub] || 0) + amt
      }
    })

  return Object.values(groups)
    .map((data) => ({
      category: data.category,
      currency: data.currency,
      total: data.total,
      subcategories: Object.entries(data.subcategories)
        .map(([subcategory, total]) => ({ subcategory, total, currency: data.currency }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total)
}

export function groupExpensesByCategory(transactions) {
  return groupByCategoryWithSubs(transactions, "expense")
}

export function groupIncomeByCategory(transactions) {
  return groupByCategoryWithSubs(transactions, "income")
}

export function getExpenseBreakdown(transactions) {
  const grouped = groupExpensesByCategory(transactions)
  const totalByCurrency = grouped.reduce((acc, g) => {
    acc[g.currency] = (acc[g.currency] || 0) + g.total
    return acc
  }, {})

  return grouped.map(({ category, currency, total: amount, subcategories }) => ({
    category,
    currency,
    amount,
    subcategories,
    percentage:
      totalByCurrency[currency] > 0
        ? (amount / totalByCurrency[currency]) * 100
        : 0,
  }))
}

export function getDailyExpenses(transactions, year, month, currency = null) {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daily = []

  for (let day = 1; day <= daysInMonth; day++) {
    daily.push({
      day,
      label: String(day),
      date: new Date(year, month, day),
      amount: 0,
    })
  }

  transactions
    .filter((t) => isExpenseTransaction(t))
    .forEach((t) => {
      const cur = getTransactionCurrency(t)
      if (currency && cur !== currency) return
      const d = new Date(t.date)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const idx = d.getDate() - 1
        if (daily[idx]) daily[idx].amount += getTransactionMajorAbs(t)
      }
    })

  return daily
}

export function getTopSpendingCategories(transactions, limit = 10) {
  return groupExpensesByCategory(transactions).slice(0, limit)
}

/** Currency with the most expense this period (for single-currency charts). */
export function getDominantExpenseCurrency(transactions) {
  const totals = {}
  transactions
    .filter((t) => isExpenseTransaction(t))
    .forEach((t) => {
      const cur = getTransactionCurrency(t)
      totals[cur] = (totals[cur] || 0) + getTransactionMajorAbs(t)
    })
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])
  return entries[0]?.[0] ?? null
}

export function getRecentTransactions(transactions, limit = 10) {
  return [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
}

export function getMonthlyIncomeExpense(transactions) {
  return [...groupByMonth(transactions)]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((m) => {
      const [year, month] = m.key.split("-").map(Number)
      const d = new Date(year, month - 1, 1)
      return {
        key: m.key,
        label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        income: m.income,
        expense: m.expense,
        savings: m.income - m.expense,
      }
    })
}

export function getCashFlowTrend(transactions) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  )
  let balance = 0

  return sorted.map((t) => {
    if (t.type === "income") balance += Number(t.amount)
    else if (isExpenseTransaction(t)) balance -= Number(t.amount)

    return {
      date: t.date,
      label: formatDisplayDate(t.date),
      balance,
    }
  })
}

export function getMonthComparison(transactions) {
  const now = new Date()
  const curYear = now.getFullYear()
  const curMonth = now.getMonth()

  const prevDate = new Date(curYear, curMonth - 1, 1)
  const prevYear = prevDate.getFullYear()
  const prevMonth = prevDate.getMonth()

  const currentTx = filterByMonth(transactions, curYear, curMonth)
  const previousTx = filterByMonth(transactions, prevYear, prevMonth)

  const currentIncome = getIncome(currentTx)
  const previousIncome = getIncome(previousTx)
  const currentExpenses = getExpenses(currentTx)
  const previousExpenses = getExpenses(previousTx)
  const currentSavings = getBalance(currentTx)
  const previousSavings = getBalance(previousTx)

  const pctChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / Math.abs(previous)) * 100
  }

  return {
    income: {
      current: currentIncome,
      previous: previousIncome,
      change: pctChange(currentIncome, previousIncome),
    },
    expenses: {
      current: currentExpenses,
      previous: previousExpenses,
      change: pctChange(currentExpenses, previousExpenses),
    },
    savings: {
      current: currentSavings,
      previous: previousSavings,
      change: pctChange(currentSavings, previousSavings),
    },
    byCurrency: {
      current: summarizeByCurrency(currentTx),
      previous: summarizeByCurrency(previousTx),
    },
  }
}

export function getFinancialInsights(transactions, currencyCode = "PHP") {
  const expenses = transactions.filter((t) => isExpenseTransaction(t))
  const income = getIncome(transactions)
  const totalExpenses = getExpenses(transactions)

  const byCategory = groupExpensesByCategory(transactions)
  const highestCategory = byCategory[0]

  const largestExpense = expenses.reduce(
    (max, t) => (Number(t.amount) > Number(max?.amount || 0) ? t : max),
    null
  )

  const dates = new Set(
    expenses.map((t) => new Date(t.date).toDateString())
  )
  const daysWithExpenses = dates.size || 1
  const avgDaily = totalExpenses / daysWithExpenses

  const savingsRate = income > 0 ? ((income - totalExpenses) / income) * 100 : 0

  const dayTotals = {}
  expenses.forEach((t) => {
    const key = new Date(t.date).toDateString()
    dayTotals[key] = (dayTotals[key] || 0) + Number(t.amount)
  })
  const mostActiveDay = Object.entries(dayTotals).sort(
    (a, b) => b[1] - a[1]
  )[0]

  const insights = []

  if (highestCategory) {
    insights.push({
      icon: "bar-chart",
      title: "Highest spending category",
      value: highestCategory.category,
      detail: formatMoney(highestCategory.total, currencyCode),
    })
  }

  if (largestExpense) {
    insights.push({
      icon: "spend",
      title: "Largest expense",
      value: formatMoney(largestExpense.amount, currencyCode),
      detail: largestExpense.category || "—",
    })
  }

  insights.push({
    icon: "calendar",
    title: "Average daily spending",
    value: formatMoney(avgDaily, currencyCode),
    detail: `${daysWithExpenses} active day${daysWithExpenses !== 1 ? "s" : ""}`,
  })

  insights.push({
    icon: "wallet",
    title: "Savings rate",
    value: `${savingsRate.toFixed(1)}%`,
    detail: income > 0 ? "Of total income" : "No income recorded",
  })

  if (mostActiveDay) {
    insights.push({
      icon: "flame",
      title: "Most active spending day",
      value: formatDisplayDate(mostActiveDay[0]),
      detail: formatMoney(mostActiveDay[1], currencyCode),
    })
  }

  return insights
}

export function buildBudgetVsActual(
  expenseCategories,
  limits,
  primaryCurrency = "USD"
) {
  const primary = (primaryCurrency || "USD").toUpperCase()
  const names = [
    ...new Set([
      ...expenseCategories.map((c) => c.category),
      ...Object.keys(limits),
    ]),
  ].sort()

  return names
    .map((category) => {
      const actual = expenseCategories
        .filter(
          (c) =>
            c.category === category &&
            (c.currency || "").toUpperCase() === primary
        )
        .reduce((sum, c) => sum + c.total, 0)
      const budget = Number(limits[category]) || 0
      return {
        category,
        budget,
        actual,
        over: budget > 0 && actual > budget,
      }
    })
    .filter((row) => row.budget > 0 || row.actual > 0)
}

export function getReportCategories(transactions) {
  return getReportCategoryOptions(transactions)
}
