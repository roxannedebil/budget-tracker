export function getBudgetSummary(categories, limits) {
  const withLimits = categories.filter((c) => Number(limits[c.category]) > 0)
  const totalBudget = withLimits.reduce(
    (sum, c) => sum + Number(limits[c.category]),
    0
  )
  const totalSpentInBudgeted = withLimits.reduce((sum, c) => sum + c.total, 0)
  const remaining = Math.max(totalBudget - totalSpentInBudgeted, 0)
  const pctUsed = totalBudget ? (totalSpentInBudgeted / totalBudget) * 100 : 0
  const overCount = withLimits.filter(
    (c) => c.total > Number(limits[c.category])
  ).length
  const onTrackCount = withLimits.length - overCount

  return {
    totalBudget,
    totalSpentInBudgeted,
    remaining,
    pctUsed,
    overCount,
    onTrackCount,
    budgetedCount: withLimits.length,
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
