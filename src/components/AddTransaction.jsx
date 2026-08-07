import "../App.css"

import { useMemo, useState } from "react"
import { supabase } from "../supabaseClient"
import CategorySelect from "./CategorySelect"
import DatePicker from "./DatePicker"
import {
  getExpenseCategories,
  getIncomeCategories,
  persistCategorySelection,
} from "../utils/categories"
import { toStoredDate } from "../utils/formatDate"

function AddTransaction({ accounts, transactions, onAdd }) {
  const [amount, setAmount] = useState("")
  const [type, setType] = useState("expense")
  const [category, setCategory] = useState("")
  const [subcategory, setSubcategory] = useState("")
  const [incomeCategory, setIncomeCategory] = useState("")
  const [incomeSubcategory, setIncomeSubcategory] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [categoryKey, setCategoryKey] = useState(0)

  const expenseCategories = useMemo(
    () => getExpenseCategories(transactions),
    [transactions, categoryKey]
  )

  const incomeCategories = useMemo(
    () => getIncomeCategories(transactions),
    [transactions, categoryKey]
  )

  const resetForm = () => {
    setAmount("")
    setCategory("")
    setSubcategory("")
    setIncomeCategory("")
    setIncomeSubcategory("")
    setNotes("")
    setType("expense")
    setFromAccountId("")
    setToAccountId("")
    setDate("")
  }

  const handleCategoryChange = (cat, sub, meta) => {
    setCategory(cat)
    setSubcategory(sub)
    if (meta?.added) setCategoryKey((k) => k + 1)
  }

  const handleIncomeCategoryChange = (cat, sub, meta) => {
    setIncomeCategory(cat)
    setIncomeSubcategory(sub)
    if (meta?.added) setCategoryKey((k) => k + 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (type === "income") {
      if (!toAccountId) {
        setError("Select which account to add money to.")
        return
      }
      if (!incomeCategory) {
        setError("Select or add an income category.")
        return
      }
    }

    if (type === "expense") {
      if (!fromAccountId) {
        setError("Select which account to spend from.")
        return
      }
      if (!category) {
        setError("Select a category.")
        return
      }
    }

    if (type === "transfer") {
      if (!fromAccountId || !toAccountId) {
        setError("Select from and to accounts.")
        return
      }
      if (fromAccountId === toAccountId) {
        setError("Accounts must be different.")
        return
      }
    }

    setSubmitting(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const depositAccount =
      type === "income"
        ? accounts.find((a) => a.account_id === toAccountId)
        : null

    const incomeSource =
      type === "income" && depositAccount?.account_type === "bank"
        ? "payroll"
        : type === "income"
          ? "other"
          : null

    if (type === "expense" && category) {
      persistCategorySelection("expense", category, subcategory)
    }

    if (type === "income" && incomeCategory) {
      persistCategorySelection("income", incomeCategory, incomeSubcategory)
    }

    const { error: insertError } = await supabase.from("transactions").insert([
      {
        amount: Number(amount),
        type,
        category:
          type === "transfer"
            ? "Transfer"
            : type === "income"
              ? incomeCategory
              : category,
        subcategory:
          type === "transfer"
            ? null
            : type === "income"
              ? incomeSubcategory || null
              : subcategory || null,
        notes,
        date: date ? toStoredDate(date) : new Date().toISOString(),
        user_id: user?.id,
        income_source: incomeSource,
        from_account_id:
          type === "expense" || type === "transfer" ? fromAccountId : null,
        to_account_id:
          type === "income" || type === "transfer" ? toAccountId : null,
      },
    ])

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    resetForm()
    setCategoryKey((k) => k + 1)
    onAdd()
  }

  return (
    <div className="card txn-form-card module-card">
      <div className="card-header txn-card-header">
        <h2>New Transaction</h2>
        <div className="type-toggle-segmented" role="group" aria-label="Transaction type">
          <button
            type="button"
            className={type === "expense" ? "active expense" : ""}
            onClick={() => setType("expense")}
          >
            <span className="type-dot expense"></span> Expense
          </button>
          <button
            type="button"
            className={type === "income" ? "active income" : ""}
            onClick={() => setType("income")}
          >
            <span className="type-dot income"></span> Income
          </button>
          <button
            type="button"
            className={type === "transfer" ? "active transfer" : ""}
            onClick={() => setType("transfer")}
          >
            <span className="type-dot transfer"></span> Transfer
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="inline-alert error">Add an account first.</p>
      ) : (
        <form onSubmit={handleSubmit} className="transaction-form-grid">
          {type === "expense" && (
            <>
              <label className="form-field">
                <span>Date</span>
                <DatePicker value={date} onChange={setDate} />
              </label>

              <label className="form-field">
                <span>Spend from</span>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <CategorySelect
                kind="expense"
                category={category}
                subcategory={subcategory}
                categories={expenseCategories}
                transactions={transactions}
                onChange={handleCategoryChange}
                placeholder="Select category"
              />

              <label className="form-field">
                <span>Amount</span>
                <div className="amount-input">
                  <span className="currency">₱</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </label>
            </>
          )}

          {type === "income" && (
            <>
              <label className="form-field">
                <span>Date</span>
                <DatePicker value={date} onChange={setDate} />
              </label>

              <label className="form-field">
                <span>Add to account</span>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <CategorySelect
                kind="income"
                category={incomeCategory}
                subcategory={incomeSubcategory}
                categories={incomeCategories}
                transactions={transactions}
                onChange={handleIncomeCategoryChange}
                placeholder="Select category"
              />

              <label className="form-field">
                <span>Amount</span>
                <div className="amount-input">
                  <span className="currency">₱</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </label>
            </>
          )}

          {type === "transfer" && (
            <>
              <label className="form-field">
                <span>Date</span>
                <DatePicker value={date} onChange={setDate} />
              </label>

              <label className="form-field">
                <span>Amount</span>
                <div className="amount-input">
                  <span className="currency">₱</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </label>

              <label className="form-field">
                <span>From</span>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>To</span>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option
                      key={a.account_id}
                      value={a.account_id}
                      disabled={a.account_id === fromAccountId}
                    >
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {/* Full Width Notes Field */}
          <label className="form-field form-field-full">
            <span>Notes</span>
            <input
              type="text"
              placeholder="Optional notes or description"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {/* Dedicated Submit Action Footer Bar */}
          <div className="txn-form-footer">
            <button
              type="submit"
              className={`submit-btn primary ${type}`}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>

          {error && <p className="inline-alert error form-row-alert">{error}</p>}
        </form>
      )}
    </div>
  )
}

export default AddTransaction
