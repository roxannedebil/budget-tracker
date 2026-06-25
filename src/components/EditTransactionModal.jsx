import "../App.css"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "../supabaseClient"
import CategorySelect from "./CategorySelect"
import {
  addExpenseCategory,
  addIncomeCategory,
  getExpenseCategories,
  getIncomeCategories,
} from "../utils/categories"
import { toDateInputValue } from "../utils/formatDate"

function EditTransactionModal({ transaction, accounts, transactions, onClose, onSaved }) {
  const [amount, setAmount] = useState("")
  const [type, setType] = useState("expense")
  const [category, setCategory] = useState("")
  const [incomeCategory, setIncomeCategory] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [categoryKey, setCategoryKey] = useState(0)

  useEffect(() => {
    if (!transaction) return

    const txnType = transaction.type || "expense"
    setType(txnType)
    setAmount(String(transaction.amount ?? ""))
    setCategory(txnType === "expense" ? transaction.category || "" : "")
    setIncomeCategory(txnType === "income" ? transaction.category || "" : "")
    setNotes(transaction.notes || "")
    setDate(toDateInputValue(transaction.date))
    setFromAccountId(transaction.from_account_id || "")
    setToAccountId(transaction.to_account_id || "")
    setError("")
  }, [transaction])

  const expenseCategories = useMemo(
    () => getExpenseCategories(transactions),
    [transactions, categoryKey]
  )

  const incomeCategories = useMemo(
    () => getIncomeCategories(transactions),
    [transactions, categoryKey]
  )

  const handleCategoryChange = (value, meta) => {
    setCategory(value)
    if (meta?.added) setCategoryKey((k) => k + 1)
  }

  const handleIncomeCategoryChange = (value, meta) => {
    setIncomeCategory(value)
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

    const id = transaction.transaction_id ?? transaction.id
    if (!id) {
      setError("Could not identify this transaction.")
      return
    }

    setSubmitting(true)

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
      addExpenseCategory(category)
    }

    if (type === "income" && incomeCategory) {
      addIncomeCategory(incomeCategory)
    }

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        amount: Number(amount),
        type,
        category:
          type === "transfer"
            ? "Transfer"
            : type === "income"
              ? incomeCategory
              : category,
        notes,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        income_source: incomeSource,
        from_account_id:
          type === "expense" || type === "transfer" ? fromAccountId : null,
        to_account_id:
          type === "income" || type === "transfer" ? toAccountId : null,
      })
      .eq("transaction_id", id)

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onSaved?.()
    onClose()
  }

  if (!transaction) return null

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card edit-txn-modal"
        role="dialog"
        aria-labelledby="edit-txn-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="edit-txn-header">
          <h2 id="edit-txn-title">Edit transaction</h2>
          <div className="type-toggle" role="group" aria-label="Transaction type">
            <button
              type="button"
              className={type === "expense" ? "active expense" : ""}
              onClick={() => setType("expense")}
            >
              Expense
            </button>
            <button
              type="button"
              className={type === "income" ? "active income" : ""}
              onClick={() => setType("income")}
            >
              Income
            </button>
            <button
              type="button"
              className={type === "transfer" ? "active transfer" : ""}
              onClick={() => setType("transfer")}
            >
              Transfer
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="inline-alert error">Add an account first.</p>
        ) : (
          <form onSubmit={handleSubmit} className="transaction-form compact">
            {type === "income" && (
              <>
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
                <label className="form-field">
                  <span>Income category</span>
                  <CategorySelect
                    kind="income"
                    value={incomeCategory}
                    categories={incomeCategories}
                    onChange={handleIncomeCategoryChange}
                    placeholder="Select or add category"
                  />
                </label>
              </>
            )}

            {type === "expense" && (
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
            )}

            {type === "transfer" && (
              <>
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
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            {type === "expense" && (
              <label className="form-field">
                <span>Category</span>
                <CategorySelect
                  kind="expense"
                  value={category}
                  categories={expenseCategories}
                  onChange={handleCategoryChange}
                  placeholder="Select or add category"
                />
              </label>
            )}

            <label className="form-field form-field-notes">
              <span>Notes</span>
              <input
                type="text"
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <div className="edit-txn-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`submit-btn inline ${type}`}
                disabled={submitting}
              >
                {submitting ? "Saving…" : "Save changes"}
              </button>
            </div>

            {error && (
              <p className="inline-alert error form-row-alert">{error}</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

export default EditTransactionModal
