import { useMemo } from "react"
import { getSubcategoriesForCategory } from "../utils/categories"

function CategorySelect({
  category = "",
  subcategory = "",
  categories = [],
  transactions = [],
  onChange,
  required = true,
  kind = "expense",
  placeholder = "Select category",
  showSubcategory = true,
  disabled = false,
}) {
  const subcategories = useMemo(
    () => getSubcategoriesForCategory(kind, category, transactions),
    [kind, category, transactions]
  )

  const allCategories = useMemo(() => {
    const customKey =
      kind === "income" ? "customIncomeCategories" : "customExpenseCategories"
    const custom = JSON.parse(localStorage.getItem(customKey) || "[]")
    return [...new Set([...categories, ...custom])].sort((a, b) =>
      a.localeCompare(b)
    )
  }, [categories, kind])

  const emit = (cat, sub) => onChange?.(cat, sub || "")

  const handleMainSelect = (e) => {
    emit(e.target.value, "")
  }

  const handleSubSelect = (e) => {
    emit(category, e.target.value)
  }

  if (allCategories.length === 0) {
    return (
      <p className="category-empty-hint">
        No categories yet — go to <strong>Settings</strong> to add some.
      </p>
    )
  }

  if (!showSubcategory) {
    return (
      <select
        value={category}
        onChange={handleMainSelect}
        required={required && !category}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {allCategories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    )
  }

  return (
    <>
      <label className="form-field">
        <span>Category</span>
        <select
          value={category}
          onChange={handleMainSelect}
          required={required && !category}
          disabled={disabled}
        >
          <option value="">{placeholder}</option>
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>

      <label className="form-field">
        <span>Subcategory</span>
        <select
          value={subcategory}
          onChange={handleSubSelect}
          className="subcategory-select"
          aria-label="Subcategory"
          disabled={disabled || !category}
        >
          {!category ? (
            <option value="">Select category first</option>
          ) : (
            <>
              <option value="">No subcategory</option>
              {subcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </>
          )}
        </select>
      </label>
    </>
  )
}

export default CategorySelect
