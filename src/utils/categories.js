const EXPENSE_KEY = "budget-expense-categories"
const INCOME_KEY = "budget-income-categories"
const LEGACY_KEY = "budget-custom-categories"

function loadList(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "[]")
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function saveList(key, list) {
  localStorage.setItem(key, JSON.stringify(list))
}

function migrateLegacyCategories() {
  const legacy = loadList(LEGACY_KEY)
  if (!legacy.length) return

  const expense = loadList(EXPENSE_KEY)
  const merged = [...new Set([...expense, ...legacy])]
  saveList(EXPENSE_KEY, merged)
  localStorage.removeItem(LEGACY_KEY)
}

migrateLegacyCategories()

function uniqueSorted(names) {
  return [...new Set(names.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}

function fromTransactions(transactions, type) {
  return transactions
    .filter((t) => t.type === type && t.category)
    .map((t) => t.category.trim())
    .filter((c) => !["Transfer"].includes(c))
}

function addCategory(kind, name) {
  const trimmed = name.trim()
  if (!trimmed) return null

  const key = kind === "income" ? INCOME_KEY : EXPENSE_KEY
  const list = loadList(key)
  if (!list.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    saveList(key, [...list, trimmed])
  }
  return trimmed
}

export function getExpenseCategories(transactions = []) {
  return uniqueSorted([
    ...loadList(EXPENSE_KEY),
    ...fromTransactions(transactions, "expense"),
  ])
}

export function getIncomeCategories(transactions = []) {
  return uniqueSorted([
    ...loadList(INCOME_KEY),
    ...fromTransactions(transactions, "income"),
  ])
}

export function getCategoriesForType(transactions, type) {
  return type === "income"
    ? getIncomeCategories(transactions)
    : getExpenseCategories(transactions)
}

export function addExpenseCategory(name) {
  return addCategory("expense", name)
}

export function addIncomeCategory(name) {
  return addCategory("income", name)
}

/** @deprecated use getExpenseCategories */
export function getAllCategories(transactions) {
  return getExpenseCategories(transactions)
}

/** @deprecated use addExpenseCategory */
export function addCustomCategory(name) {
  return addExpenseCategory(name)
}

export function getBudgetCategoryList(transactions, limits = {}) {
  const monthExpense = fromTransactions(transactions, "expense")
  return uniqueSorted([
    ...getExpenseCategories(transactions),
    ...monthExpense,
    ...Object.keys(limits),
  ])
}

export function getReportCategoryOptions(transactions) {
  const expense = getExpenseCategories(transactions)
  const income = getIncomeCategories(transactions)
  return {
    expense,
    income,
    all: uniqueSorted([...expense, ...income]),
  }
}
