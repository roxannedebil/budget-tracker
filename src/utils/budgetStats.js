export function getCategorySpendRows(categories, category) {
  return categories.filter((c) => c.category === category)
}

export function getCategorySpentInCurrency(categories, category, currencyCode) {
  const cur = (currencyCode || "USD").toUpperCase()
  return categories
    .filter(
      (c) =>
        c.category === category && (c.currency || "").toUpperCase() === cur
    )
    .reduce((sum, c) => sum + c.total, 0)
}

export function getBudgetSummary(categories, limits, primaryCurrency = "USD") {
  const primary = primaryCurrency.toUpperCase()
  const budgetedCategoryNames = Object.entries(limits)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([cat]) => cat)

  const totalBudget = budgetedCategoryNames.reduce(
    (sum, cat) => sum + Number(limits[cat]),
    0
  )
  const totalSpentInBudgeted = budgetedCategoryNames.reduce(
    (sum, cat) =>
      sum + getCategorySpentInCurrency(categories, cat, primary),
    0
  )
  const remaining = Math.max(totalBudget - totalSpentInBudgeted, 0)
  const pctUsed = totalBudget
    ? (totalSpentInBudgeted / totalBudget) * 100
    : 0
  const overCount = budgetedCategoryNames.filter(
    (cat) =>
      getCategorySpentInCurrency(categories, cat, primary) >
      Number(limits[cat])
  ).length
  const onTrackCount = budgetedCategoryNames.length - overCount

  return {
    totalBudget,
    totalSpentInBudgeted,
    remaining,
    pctUsed,
    overCount,
    onTrackCount,
    budgetedCount: budgetedCategoryNames.length,
  }
}

export function getBudgetChartData(categories, limits) {
  return categories
    .filter((c) => Number(limits[c.category]) > 0)
    .map((c, i) => ({
      label: c.category,
      value: Number(limits[c.category]),
      spent: c.total,
    }))
    .sort((a, b) => b.value - a.value)
}
