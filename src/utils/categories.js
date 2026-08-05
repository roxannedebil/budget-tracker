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

function subcategoriesFromTransactions(transactions, type, parentCategory) {
  const parent = parentCategory.trim()
  if (!parent) return []

  return transactions
    .filter(
      (t) =>
        t.type === type &&
        t.category?.trim() === parent &&
        t.subcategory?.trim()
    )
    .map((t) => t.subcategory.trim())
}

export function getExpenseCategories(transactions = []) {
  const fromTx = uniqueSorted(fromTransactions(transactions, "expense"))
  const custom = JSON.parse(localStorage.getItem("customExpenseCategories") || "[]")
  return uniqueSorted([...fromTx, ...custom])
}

export function getIncomeCategories(transactions = []) {
  const fromTx = uniqueSorted(fromTransactions(transactions, "income"))
  const custom = JSON.parse(localStorage.getItem("customIncomeCategories") || "[]")
  return uniqueSorted([...fromTx, ...custom])
}

export function getCategoriesForType(transactions, type) {
  return type === "income"
    ? getIncomeCategories(transactions)
    : getExpenseCategories(transactions)
}

export function getSubcategoriesForCategory(
  kind,
  parentCategory,
  transactions = []
) {
  const parent = (parentCategory || "").trim()
  if (!parent) return []

  const fromTx = uniqueSorted(
    subcategoriesFromTransactions(
      transactions,
      kind === "income" ? "income" : "expense",
      parent
    )
  )
  
  // Also get custom subcategories from localStorage
  const key = `customSubcategories_${kind}_${parent}`
  const custom = JSON.parse(localStorage.getItem(key) || "[]")
  
  return uniqueSorted([...fromTx, ...custom])
}

export function addExpenseCategory(name) {
  const trimmed = name?.trim()
  if (trimmed) {
    // Store in localStorage for persistence
    const key = "customExpenseCategories"
    const categories = JSON.parse(localStorage.getItem(key) || "[]")
    if (!categories.includes(trimmed)) {
      categories.push(trimmed)
      localStorage.setItem(key, JSON.stringify(categories))
    }
  }
  return trimmed || null
}

export function addIncomeCategory(name) {
  const trimmed = name?.trim()
  if (trimmed) {
    // Store in localStorage for persistence
    const key = "customIncomeCategories"
    const categories = JSON.parse(localStorage.getItem(key) || "[]")
    if (!categories.includes(trimmed)) {
      categories.push(trimmed)
      localStorage.setItem(key, JSON.stringify(categories))
    }
  }
  return trimmed || null
}

export function addSubcategory(kind, parentCategory, subName) {
  const trimmed = subName?.trim()
  const parent = parentCategory?.trim()
  if (trimmed && parent) {
    // Store in localStorage for persistence
    const key = `customSubcategories_${kind}_${parent}`
    const subcategories = JSON.parse(localStorage.getItem(key) || "[]")
    if (!subcategories.includes(trimmed)) {
      subcategories.push(trimmed)
      localStorage.setItem(key, JSON.stringify(subcategories))
    }
  }
  return trimmed || null
}

export function addExpenseSubcategory(parentCategory, subName) {
  return addSubcategory("expense", parentCategory, subName)
}

export function addIncomeSubcategory(parentCategory, subName) {
  return addSubcategory("income", parentCategory, subName)
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

export function persistCategorySelection(kind, category, subcategory) {
  if (!category) return
  
  // Ensure category exists in custom categories
  const catKey = kind === "income" ? "customIncomeCategories" : "customExpenseCategories"
  const categories = JSON.parse(localStorage.getItem(catKey) || "[]")
  if (!categories.includes(category)) {
    categories.push(category)
    localStorage.setItem(catKey, JSON.stringify(categories))
  }
  
  // Ensure subcategory exists if provided
  if (subcategory?.trim()) {
    const subKey = `customSubcategories_${kind}_${category}`
    const subcategories = JSON.parse(localStorage.getItem(subKey) || "[]")
    if (!subcategories.includes(subcategory)) {
      subcategories.push(subcategory)
      localStorage.setItem(subKey, JSON.stringify(subcategories))
    }
  }
}

export function isCategoryInUse(kind, category, transactions = []) {
  return transactions.some(
    (t) =>
      t.type === (kind === "income" ? "income" : "expense") &&
      t.category?.trim() === category.trim()
  )
}

export function isSubcategoryInUse(kind, parentCategory, subcategory, transactions = []) {
  return transactions.some(
    (t) =>
      t.type === (kind === "income" ? "income" : "expense") &&
      t.category?.trim() === parentCategory.trim() &&
      t.subcategory?.trim() === subcategory.trim()
  )
}

export function deleteCategory(kind, category) {
  const key = kind === "income" ? "customIncomeCategories" : "customExpenseCategories"
  const categories = JSON.parse(localStorage.getItem(key) || "[]")
  const updated = categories.filter((c) => c !== category)
  localStorage.setItem(key, JSON.stringify(updated))
  
  // Also delete any subcategories under this category
  const subKey = `customSubcategories_${kind}_${category}`
  localStorage.removeItem(subKey)
}

export function deleteSubcategory(kind, parentCategory, subcategory) {
  const key = `customSubcategories_${kind}_${parentCategory}`
  const subcategories = JSON.parse(localStorage.getItem(key) || "[]")
  const updated = subcategories.filter((s) => s !== subcategory)
  localStorage.setItem(key, JSON.stringify(updated))
}
