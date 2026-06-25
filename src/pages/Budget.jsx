import { useEffect, useMemo, useState } from "react"
import CategorySelect from "../components/CategorySelect"
import {
  getExpenseCategories,
  addExpenseCategory,
} from "../utils/categories"
import {
  buildBudgetVsActual,
  groupExpensesByCategory,
} from "../utils/analytics"
import { getBudgetSummary } from "../utils/budgetStats"
import {
  formatMoney,
  getCurrentMonthTransactions,
  getExpenses,
} from "../utils/transactionStats"
import StatCard from "../components/StatCard"
import ChartCard from "../components/ChartCard"
import BudgetVsActualChart from "../components/charts/BudgetVsActualChart"
import ProgressRing from "../components/charts/ProgressRing"
import LoadingState from "../components/LoadingState"
import EmptyState from "../components/EmptyState"

const BUDGET_KEY = "budget-limits"

function loadBudgetLimits() {
  try {
    return JSON.parse(localStorage.getItem(BUDGET_KEY) || "{}")
  } catch {
    return {}
  }
}

function Budget({ transactions, loading }) {
  const monthTx = useMemo(
    () => getCurrentMonthTransactions(transactions),
    [transactions]
  )
  const spendingByCategory = useMemo(
    () => groupExpensesByCategory(monthTx),
    [monthTx]
  )
  const totalSpent = getExpenses(monthTx)
  const [limits, setLimits] = useState(loadBudgetLimits)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState("")
  const [addCategory, setAddCategory] = useState("")
  const [addAmount, setAddAmount] = useState("")
  const [addError, setAddError] = useState("")
  const [categoryKey, setCategoryKey] = useState(0)

  const savedCategories = useMemo(
    () => getExpenseCategories(transactions),
    [transactions, categoryKey]
  )

  const budgetedCategories = useMemo(
    () =>
      Object.entries(limits)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([category]) => category)
        .sort((a, b) => a.localeCompare(b)),
    [limits]
  )

  const categoriesForAdd = useMemo(
    () =>
      savedCategories.filter(
        (cat) => !limits[cat] || Number(limits[cat]) <= 0
      ),
    [savedCategories, limits]
  )

  const unbudgetedSpending = useMemo(
    () =>
      spendingByCategory.filter(
        (c) => !limits[c.category] || Number(limits[c.category]) <= 0
      ),
    [spendingByCategory, limits]
  )

  useEffect(() => {
    localStorage.setItem(BUDGET_KEY, JSON.stringify(limits))
  }, [limits])

  const summary = useMemo(
    () => getBudgetSummary(spendingByCategory, limits),
    [spendingByCategory, limits]
  )

  const budgetVsActual = useMemo(
    () => buildBudgetVsActual(spendingByCategory, limits),
    [spendingByCategory, limits]
  )

  const removeLimit = (category) => {
    const next = { ...limits }
    delete next[category]
    setLimits(next)
    if (editing === category) {
      setEditing(null)
      setDraft("")
    }
  }

  const startEdit = (category) => {
    setEditing(category)
    setDraft(String(limits[category] ?? ""))
    setAddError("")
  }

  const saveLimit = (category) => {
    const value = Number(draft)
    if (!draft || Number.isNaN(value) || value <= 0) {
      removeLimit(category)
    } else {
      addExpenseCategory(category)
      setLimits({ ...limits, [category]: value })
    }
    setEditing(null)
    setDraft("")
  }

  const handleAddCategoryPick = (value, meta) => {
    setAddCategory(value)
    setAddError("")
    if (meta?.added) setCategoryKey((k) => k + 1)
  }

  const handleAddBudget = (e) => {
    e.preventDefault()
    setAddError("")

    if (!addCategory) {
      setAddError("Choose a category.")
      return
    }
    const value = Number(addAmount)
    if (!addAmount || Number.isNaN(value) || value <= 0) {
      setAddError("Enter a monthly amount greater than zero.")
      return
    }
    if (limits[addCategory] && Number(limits[addCategory]) > 0) {
      setAddError("This category already has a budget. Edit it below.")
      return
    }

    addExpenseCategory(addCategory)
    setLimits({ ...limits, [addCategory]: value })
    setAddCategory("")
    setAddAmount("")
    setCategoryKey((k) => k + 1)
  }

  const quickSetBudget = (category) => {
    setAddCategory(category)
    setAddAmount("")
    setAddError("")
    document.getElementById("budget-add-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }

  if (loading) {
    return <LoadingState message="Loading budget…" />
  }

  return (
    <div className="page budget-page module-page">
      <div className="budget-overview module-panel">
        <div className="budget-overview-ring">
          <ProgressRing
            value={summary.pctUsed}
            label="Budget used"
            sublabel="this month"
            variant={summary.pctUsed > 100 ? "expense" : "accent"}
            size={140}
          />
        </div>
        <div className="stat-grid stat-grid-4 budget-stat-grid">
          <StatCard
            icon="💸"
            label="Spent"
            value={formatMoney(totalSpent)}
            variant="expense"
          />
          <StatCard
            icon="🎯"
            label="Total budget"
            value={formatMoney(summary.totalBudget)}
            hint={`${summary.budgetedCount} with limits`}
          />
          <StatCard
            icon="💰"
            label="Remaining"
            value={formatMoney(summary.remaining)}
            variant="income"
          />
          <StatCard
            icon={summary.overCount > 0 ? "⚠️" : "✅"}
            label="Over budget"
            value={String(summary.overCount)}
            hint={
              summary.overCount > 0
                ? `${summary.overCount} categor${summary.overCount === 1 ? "y" : "ies"}`
                : "All on track"
            }
            variant={summary.overCount > 0 ? "expense" : "income"}
          />
        </div>
      </div>

      <ChartCard
        title="Budget vs actual"
        className="chart-span-full module-card"
      >
        <BudgetVsActualChart data={budgetVsActual} />
      </ChartCard>

      <div id="budget-add-panel" className="card budget-add-panel module-card">
        <div className="budget-add-panel-head">
          <div>
            <h2>Add budget</h2>
            <p className="muted budget-add-hint">
              Only categories you set here get a monthly limit.
            </p>
          </div>
        </div>
        <form className="budget-add-form" onSubmit={handleAddBudget}>
          <label className="budget-add-field">
            <span>Category</span>
            <CategorySelect
              kind="expense"
              value={addCategory}
              categories={categoriesForAdd}
              onChange={handleAddCategoryPick}
              placeholder="Select or add category"
              required={false}
            />
          </label>
          <label className="budget-add-field">
            <span>Monthly limit</span>
            <div className="amount-input">
              <span className="currency">₱</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
              />
            </div>
          </label>
          <button type="submit" className="budget-add-submit">
            Add budget
          </button>
        </form>
        {addError && <p className="inline-alert error">{addError}</p>}
      </div>

      <div className="card module-card">
        <div className="card-header">
          <h2>Your budgets</h2>
          <span className="chip">
            {budgetedCategories.length} active
          </span>
        </div>

        {budgetedCategories.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="No budgets set"
            message="Use the form above to add a limit for any category you want to track."
          />
        ) : (
          <div className="budget-cards">
            {budgetedCategories.map((category) => {
              const spent =
                spendingByCategory.find((c) => c.category === category)
                  ?.total ?? 0
              const limit = Number(limits[category])
              const pct = limit ? (spent / limit) * 100 : 0
              const over = spent > limit
              const isEditing = editing === category

              return (
                <article
                  key={category}
                  className={`budget-card ${over ? "over-budget" : ""}`}
                >
                  <div className="budget-card-head">
                    <div className="budget-card-title">
                      <span className="budget-category">{category}</span>
                      <span
                        className={`budget-badge ${over ? "over" : pct >= 80 ? "warn" : "ok"}`}
                      >
                        {over
                          ? "Over"
                          : pct >= 80
                            ? "Almost"
                            : "On track"}
                      </span>
                    </div>
                    <div className="budget-card-amounts">
                      <span className="expense-text">{formatMoney(spent)}</span>
                      <span className="muted"> / {formatMoney(limit)}</span>
                    </div>
                  </div>

                  <div className="bar-track">
                    <div
                      className={`bar-fill ${over ? "over" : "expense"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <p className="budget-pct muted">
                    {pct.toFixed(0)}% used
                    {over && ` · ${formatMoney(spent - limit)} over`}
                  </p>

                  {isEditing ? (
                    <div className="budget-card-edit">
                      <div className="amount-input budget-edit-amount">
                        <span className="currency">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === "Enter" && saveLimit(category)
                          }
                          autoFocus
                        />
                      </div>
                      <div className="budget-card-actions">
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => saveLimit(category)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn-sm ghost"
                          onClick={() => {
                            setEditing(null)
                            setDraft("")
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="budget-card-actions">
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => startEdit(category)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-sm ghost budget-remove-btn"
                        onClick={() => removeLimit(category)}
                      >
                        Remove budget
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      {unbudgetedSpending.length > 0 && (
        <div className="card module-card budget-unbudgeted-card">
          <div className="card-header">
            <h2>Spending without a budget</h2>
            <span className="chip muted-chip">Optional</span>
          </div>
          <p className="muted compact-hint budget-unbudgeted-hint">
            These categories have expenses this month but no limit set. Add a
            budget only if you want to track them.
          </p>
          <ul className="budget-unbudgeted-list">
            {unbudgetedSpending.map(({ category, total }) => (
              <li key={category}>
                <div className="budget-unbudgeted-row">
                  <span className="budget-category">{category}</span>
                  <span className="expense-text">{formatMoney(total)}</span>
                </div>
                <button
                  type="button"
                  className="btn-sm ghost"
                  onClick={() => quickSetBudget(category)}
                >
                  Add budget
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default Budget
