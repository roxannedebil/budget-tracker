import { useState, useMemo } from "react"
import {
  getExpenseCategories,
  getIncomeCategories,
  addExpenseCategory,
  addIncomeCategory,
  deleteCategory,
  isCategoryInUse,
  getSubcategoriesForCategory,
  addExpenseSubcategory,
  addIncomeSubcategory,
  deleteSubcategory,
  isSubcategoryInUse,
} from "../utils/categories"

function Settings({ transactions = [] }) {
  const [activeTab, setActiveTab] = useState("expense")
  const [refreshKey, setRefreshKey] = useState(0)

  // ── Category add state
  const [newCatName, setNewCatName] = useState("")
  const [catError, setCatError] = useState("")

  // ── Per-category expanded / adding-subcategory state
  const [expandedCat, setExpandedCat] = useState(null)
  const [addingSubFor, setAddingSubFor] = useState(null)
  const [newSubName, setNewSubName] = useState("")
  const [subError, setSubError] = useState("")

  const kind = activeTab // "expense" | "income"

  const categories = useMemo(() => {
    return kind === "income"
      ? getIncomeCategories(transactions)
      : getExpenseCategories(transactions)
  }, [kind, transactions, refreshKey])

  const refresh = () => setRefreshKey((k) => k + 1)

  // ── Add category
  const handleAddCategory = (e) => {
    e.preventDefault()
    setCatError("")
    const trimmed = newCatName.trim()
    if (!trimmed) {
      setCatError("Category name cannot be empty.")
      return
    }
    if (categories.map((c) => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      setCatError("That category already exists.")
      return
    }
    const addFn = kind === "income" ? addIncomeCategory : addExpenseCategory
    addFn(trimmed)
    setNewCatName("")
    refresh()
  }

  // ── Delete category
  const handleDeleteCategory = (cat) => {
    if (isCategoryInUse(kind, cat, transactions)) return
    deleteCategory(kind, cat)
    if (expandedCat === cat) setExpandedCat(null)
    refresh()
  }

  // ── Toggle expand subcategories
  const toggleExpand = (cat) => {
    setExpandedCat((prev) => (prev === cat ? null : cat))
    setAddingSubFor(null)
    setNewSubName("")
    setSubError("")
  }

  // ── Add subcategory
  const handleAddSubcategory = (cat) => {
    setSubError("")
    const trimmed = newSubName.trim()
    if (!trimmed) {
      setSubError("Subcategory name cannot be empty.")
      return
    }
    const subs = getSubcategoriesForCategory(kind, cat, transactions)
    if (subs.map((s) => s.toLowerCase()).includes(trimmed.toLowerCase())) {
      setSubError("That subcategory already exists.")
      return
    }
    const addFn = kind === "income" ? addIncomeSubcategory : addExpenseSubcategory
    addFn(cat, trimmed)
    setNewSubName("")
    setAddingSubFor(null)
    refresh()
  }

  // ── Delete subcategory
  const handleDeleteSubcategory = (cat, sub) => {
    if (isSubcategoryInUse(kind, cat, sub, transactions)) return
    deleteSubcategory(kind, cat, sub)
    refresh()
  }

  const switchTab = (tab) => {
    setActiveTab(tab)
    setExpandedCat(null)
    setAddingSubFor(null)
    setNewCatName("")
    setCatError("")
    setNewSubName("")
    setSubError("")
  }

  const expenseCount = useMemo(
    () => getExpenseCategories(transactions).length,
    [transactions, refreshKey]
  )
  const incomeCount = useMemo(
    () => getIncomeCategories(transactions).length,
    [transactions, refreshKey]
  )

  return (
    <div className="page settings-page module-page">
      {/* Page Header */}
      <div className="settings-header module-card">
        <div className="settings-header-icon">⚙️</div>
        <div className="settings-header-text">
          <h1>Settings</h1>
          <p className="settings-header-sub">
            Manage your categories and subcategories. Changes apply immediately across all forms.
          </p>
        </div>
      </div>

      {/* Category Manager */}
      <div className="card settings-cat-card module-card">
        <div className="card-header">
          <h2>Categories &amp; Subcategories</h2>
          <span className="chip">
            {expenseCount + incomeCount} total
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="settings-tabs">
          <button
            id="settings-tab-expense"
            type="button"
            className={`settings-tab ${activeTab === "expense" ? "active expense" : ""}`}
            onClick={() => switchTab("expense")}
          >
            <span className="settings-tab-icon">💸</span>
            Expense
            <span className={`settings-tab-count ${activeTab === "expense" ? "active" : ""}`}>
              {expenseCount}
            </span>
          </button>
          <button
            id="settings-tab-income"
            type="button"
            className={`settings-tab ${activeTab === "income" ? "active income" : ""}`}
            onClick={() => switchTab("income")}
          >
            <span className="settings-tab-icon">💰</span>
            Income
            <span className={`settings-tab-count ${activeTab === "income" ? "active" : ""}`}>
              {incomeCount}
            </span>
          </button>
        </div>

        {/* Add Category Form */}
        <form className="settings-add-cat-form" onSubmit={handleAddCategory}>
          <label className="form-field settings-add-cat-field">
            <span>New {kind} category</span>
            <input
              id="settings-new-category-input"
              type="text"
              placeholder={`e.g. ${kind === "expense" ? "Food, Transport, Bills" : "Salary, Freelance, Gifts"}`}
              value={newCatName}
              onChange={(e) => {
                setNewCatName(e.target.value)
                if (catError) setCatError("")
              }}
            />
          </label>
          <button id="settings-add-category-btn" type="submit" className="settings-add-btn btn-sm">
            + Add category
          </button>
        </form>
        {catError && <p className="inline-alert error">{catError}</p>}

        {/* Category List */}
        {categories.length === 0 ? (
          <div className="settings-empty">
            <span className="settings-empty-icon">🗂️</span>
            <p className="settings-empty-title">No {kind} categories yet</p>
            <p className="settings-empty-hint">
              Use the field above to create your first {kind} category.
            </p>
          </div>
        ) : (
          <ul className="settings-cat-list">
            {categories.map((cat) => {
              const inUse = isCategoryInUse(kind, cat, transactions)
              const isExpanded = expandedCat === cat
              const subcategories = getSubcategoriesForCategory(kind, cat, transactions)

              return (
                <li key={cat} className={`settings-cat-row ${isExpanded ? "expanded" : ""}`}>
                  {/* Category header */}
                  <div className="settings-cat-row-head">
                    <button
                      type="button"
                      className="settings-cat-expand-btn"
                      onClick={() => toggleExpand(cat)}
                      aria-expanded={isExpanded}
                      title={isExpanded ? "Collapse" : `Show subcategories (${subcategories.length})`}
                    >
                      <span className="settings-expand-arrow">{isExpanded ? "▾" : "▸"}</span>
                      <span className="settings-cat-name">{cat}</span>
                      {subcategories.length > 0 && (
                        <span className="settings-sub-count">{subcategories.length} sub</span>
                      )}
                    </button>

                    <div className="settings-cat-actions">
                      {inUse ? (
                        <span className="settings-in-use-badge" title="Used by transactions — cannot delete">
                          In use
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="settings-delete-btn"
                          onClick={() => handleDeleteCategory(cat)}
                          title="Delete category"
                          aria-label={`Delete ${cat}`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Subcategories section */}
                  {isExpanded && (
                    <div className="settings-sub-section">
                      {subcategories.length > 0 && (
                        <ul className="settings-sub-list">
                          {subcategories.map((sub) => {
                            const subInUse = isSubcategoryInUse(kind, cat, sub, transactions)
                            return (
                              <li key={sub} className="settings-sub-row">
                                <span className="settings-sub-name">
                                  <span className="settings-sub-bullet">└</span>
                                  {sub}
                                </span>
                                <div className="settings-sub-actions">
                                  {subInUse ? (
                                    <span className="settings-in-use-badge" title="In use — cannot delete">
                                      In use
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="settings-delete-btn"
                                      onClick={() => handleDeleteSubcategory(cat, sub)}
                                      title="Delete subcategory"
                                      aria-label={`Delete ${sub}`}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}

                      {/* Add subcategory inline */}
                      {addingSubFor === cat ? (
                        <>
                          <div className="settings-add-sub-row">
                            <input
                              id={`settings-new-sub-input-${cat}`}
                              type="text"
                              placeholder={`Subcategory name…`}
                              value={newSubName}
                              autoFocus
                              onChange={(e) => {
                                setNewSubName(e.target.value)
                                if (subError) setSubError("")
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  handleAddSubcategory(cat)
                                }
                                if (e.key === "Escape") {
                                  setAddingSubFor(null)
                                  setNewSubName("")
                                  setSubError("")
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="btn-sm settings-sub-save-btn"
                              onClick={() => handleAddSubcategory(cat)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="btn-sm ghost"
                              onClick={() => {
                                setAddingSubFor(null)
                                setNewSubName("")
                                setSubError("")
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                          {subError && <p className="inline-alert error">{subError}</p>}
                        </>
                      ) : (
                        <button
                          type="button"
                          className="settings-add-sub-btn"
                          onClick={() => { setAddingSubFor(cat); setNewSubName(""); setSubError("") }}
                        >
                          + Add subcategory
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Settings
