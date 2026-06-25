export const EXPENSE_CATEGORIES = [
  "Food",
  "Transport",
  "Load",
  "Subscriptions",
  "Shopping",
  "Bills",
  "Entertainment",
  "Savings",
  "Other",
]

export const INCOME_CATEGORIES = [
  "Salary",
  "Bonus",
  "Allowance",
  "Freelance",
  "Business",
  "Other",
]

export function normalizeExpenseCategory(category) {
  const name = (category || "").trim()
  if (!name) return "Other"
  const match = EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase() === name.toLowerCase()
  )
  return match || "Other"
}

export function normalizeIncomeCategory(category) {
  const name = (category || "").trim()
  if (!name) return "Other"
  const match = INCOME_CATEGORIES.find(
    (c) => c.toLowerCase() === name.toLowerCase()
  )
  return match || "Other"
}
