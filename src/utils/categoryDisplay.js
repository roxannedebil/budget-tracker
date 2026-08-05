/** Format category + optional subcategory for display */
export function formatCategoryLabel(category, subcategory) {
  const main = (category || "").trim()
  const sub = (subcategory || "").trim()
  if (!main) return "—"
  if (sub) return `${main} › ${sub}`
  return main
}

/** Sort key combining category and subcategory */
export function categorySortKey(category, subcategory) {
  return formatCategoryLabel(category, subcategory).toLowerCase()
}
