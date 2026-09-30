/** Optional metadata for income rows; category field is always user-defined. */
export function resolveIncomeSource(type, category) {
  if (type !== "income") return null
  const normalized = (category || "").trim().toLowerCase()
  if (normalized === "payroll") return "payroll"
  return "other"
}
