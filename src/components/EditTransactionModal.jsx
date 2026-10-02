import "../App.css"

import { useEffect, useMemo, useState } from "react"
import ModalPortal from "./ModalPortal"
import Icon from "./icons/Icons"
import PendingTransferEditStepper from "./PendingTransferEditStepper"
import { supabase } from "../supabaseClient"
import CategorySelect from "./CategorySelect"
import DatePicker from "./DatePicker"
import {
  getExpenseCategories,
  getIncomeCategories,
  persistCategorySelection,
} from "../utils/categories"
import { toDateInputValue, toStoredDate } from "../utils/formatDate"
import { resolveIncomeSource } from "../utils/incomeSource"
import CurrencySelect from "./CurrencySelect"
import AccountSelect from "./AccountSelect"
import {
  accountShowsCurrencyPicker,
  getAccountCurrencyOptions,
} from "../utils/accountCurrencies"
import {
  getTransactionCurrency,
  isPositiveMoneyAmount,
} from "../utils/currency"
import { currencyInputPrefix } from "../utils/currencySymbol"
import { useCurrency } from "../context/CurrencyContext"
import { buildIncomeExpensePayload } from "../utils/transactionPayload"
import {
  getTransferKey,
  getTransferLegs,
  isCompletedTransferGroup,
  isLinkedTransferFee,
  isPendingTransferGroup,
} from "../utils/transferLifecycle"

function EditTransactionModal({
  transaction,
  accounts,
  transactions,
  onClose,
  onSaved,
  focusComplete = false,
}) {
  const { primary, ratesTable } = useCurrency()
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("PHP")
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
  const [transferHeader, setTransferHeader] = useState(null)
  const [transferHeaderLoaded, setTransferHeaderLoaded] = useState(false)

  const editKind = useMemo(() => {
    if (!transaction) return null
    if (isLinkedTransferFee(transaction)) return "linkedFee"
    if (isCompletedTransferGroup(transaction, transactions)) return "completedTransfer"
    if (isPendingTransferGroup(transaction, transactions)) return "pendingTransfer"
    if (transaction.type === "income") return "income"
    if (transaction.type === "fee" && !getTransferKey(transaction)) return "expense"
    if (transaction.type === "expense") return "expense"
    return "completedTransfer"
  }, [transaction, transactions])

  const transferKey = useMemo(() => getTransferKey(transaction), [transaction])
  const transferLegs = useMemo(
    () => getTransferLegs(transaction, transactions),
    [transaction, transactions]
  )

  useEffect(() => {
    if (!transaction) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !submitting) onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [transaction, onClose, submitting])

  useEffect(() => {
    if (!transaction) return
    setAmount(String(transaction.amount ?? ""))
    setNotes(transaction.notes || "")
    setDate(toDateInputValue(transaction.date))
    setFromAccountId(transaction.from_account_id || "")
    setToAccountId(transaction.to_account_id || "")
    setCurrency(getTransactionCurrency(transaction))
    setError("")

    if (transaction.type === "income") {
      setIncomeCategory(transaction.category || "")
      setIncomeSubcategory(transaction.subcategory || "")
      setCategory("")
      setSubcategory("")
    } else {
      setCategory(transaction.category || "")
      setSubcategory(transaction.subcategory || "")
      setIncomeCategory("")
      setIncomeSubcategory("")
    }
  }, [transaction])

  const [linkedFeeRow, setLinkedFeeRow] = useState(null)
  const [linkedTransferOut, setLinkedTransferOut] = useState(null)
  const [pendingTransferDataLoaded, setPendingTransferDataLoaded] = useState(false)

  useEffect(() => {
    if (!transferKey || editKind !== "pendingTransfer") {
      setTransferHeader(null)
      setTransferHeaderLoaded(false)
      setLinkedFeeRow(null)
      setLinkedTransferOut(null)
      setPendingTransferDataLoaded(false)
      return
    }
    let cancelled = false
    setTransferHeaderLoaded(false)
    setPendingTransferDataLoaded(false)
    Promise.all([
      supabase.from("transfers").select("*").eq("transfer_id", transferKey).maybeSingle(),
      supabase
        .from("transactions")
        .select("*")
        .eq("transfer_id", transferKey)
        .eq("type", "fee")
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("*")
        .eq("transfer_id", transferKey)
        .eq("type", "transfer_out")
        .maybeSingle(),
    ]).then(([headerRes, feeRes, outRes]) => {
      if (cancelled) return
      setTransferHeader(headerRes.data ?? null)
      setTransferHeaderLoaded(true)
      setLinkedFeeRow(feeRes.data ?? null)
      setLinkedTransferOut(outRes.data ?? null)
      setPendingTransferDataLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [transferKey, editKind])

  const fromAccount = accounts.find((a) => a.account_id === fromAccountId)
  const toAccount = accounts.find((a) => a.account_id === toAccountId)
  const fromCurrencyOptions = useMemo(
    () => getAccountCurrencyOptions(fromAccount),
    [fromAccount]
  )
  const toCurrencyOptions = useMemo(
    () => getAccountCurrencyOptions(toAccount),
    [toAccount]
  )
  const showFromCurrencyPicker = accountShowsCurrencyPicker(fromAccount)
  const showToCurrencyPicker = accountShowsCurrencyPicker(toAccount)

  const expenseCategories = useMemo(
    () => getExpenseCategories(transactions),
    [transactions, categoryKey]
  )
  const incomeCategories = useMemo(
    () => getIncomeCategories(transactions),
    [transactions, categoryKey]
  )

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

    if (editKind === "income") {
      if (!toAccountId) {
        setError("Select which account to add money to.")
        return
      }
      if (!incomeCategory) {
        setError("Select or add an income category.")
        return
      }
    }

    if (editKind === "expense") {
      if (!fromAccountId) {
        setError("Select which account to spend from.")
        return
      }
      if (!category) {
        setError("Select a category.")
        return
      }
    }

    if (!isPositiveMoneyAmount(amount)) {
      setError("Amount must be greater than zero.")
      return
    }

    const id = transaction.transaction_id ?? transaction.id
    if (!id) {
      setError("Could not identify this transaction.")
      return
    }

    setSubmitting(true)

    const incomeSource =
      editKind === "income" ? resolveIncomeSource("income", incomeCategory) : null

    if (editKind === "expense" && category) {
      persistCategorySelection("expense", category, subcategory)
    }
    if (editKind === "income" && incomeCategory) {
      persistCategorySelection("income", incomeCategory, incomeSubcategory)
    }

    const storedDate = date ? toStoredDate(date) : new Date().toISOString()

    const payload = buildIncomeExpensePayload({
      type: editKind === "income" ? "income" : "expense",
      amountMajor: amount,
      currency,
      primary,
      ratesTable,
      fields: {
        category: editKind === "income" ? incomeCategory : category,
        subcategory:
          editKind === "income"
            ? incomeSubcategory || null
            : subcategory || null,
        notes,
        date: storedDate,
        income_source: incomeSource,
        from_account_id: editKind === "expense" ? fromAccountId : null,
        to_account_id: editKind === "income" ? toAccountId : null,
      },
    })

    const { error: updateError } = await supabase
      .from("transactions")
      .update(payload)
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

  const modalShell = (content, wide = false) => (
    <ModalPortal>
      <div className="modal-overlay edit-txn-overlay" role="presentation" onClick={onClose}>
        <div
          className={`modal-card edit-txn-modal${wide ? " edit-txn-modal-wide" : ""}`}
          role="dialog"
          aria-labelledby="edit-txn-title"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    </ModalPortal>
  )

  const titleBar = (title) => (
    <div className="edit-txn-header">
      <div className="edit-txn-title-row">
        <h2 id="edit-txn-title">{title}</h2>
        <button
          type="button"
          className="txn-detail-close edit-txn-close"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  )

  if (editKind === "linkedFee") {
    return modalShell(
      <>
        {titleBar("Edit transaction")}
        <p className="muted">
          This fee is part of a transfer. Edit or delete the transfer from its main row
          instead.
        </p>
        <div className="txn-form-footer modal-actions-footer">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </>
    )
  }

  if (editKind === "completedTransfer") {
    return modalShell(
      <>
        {titleBar("Transfer completed")}
        <p className="muted form-field">
          Completed transfers cannot be edited. Delete this transfer and create a new one if
          you need different amounts, accounts, or fees.
        </p>
        <div className="txn-form-footer modal-actions-footer">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </>
    )
  }

  if (editKind === "pendingTransfer") {
    return modalShell(
      <>
        {titleBar(focusComplete ? "Complete transfer" : "Pending transfer")}
        <PendingTransferEditStepper
          accounts={accounts}
          transactions={transactions}
          transferLegs={transferLegs}
          transferKey={transferKey}
          transferHeader={transferHeader}
          transferHeaderLoaded={transferHeaderLoaded}
          linkedFeeRow={linkedFeeRow}
          linkedTransferOut={linkedTransferOut}
          pendingTransferDataLoaded={pendingTransferDataLoaded}
          focusComplete={focusComplete}
          onClose={onClose}
          onSaved={onSaved}
        />
      </>,
      true
    )
  }

  return modalShell(
    <>
      {titleBar(editKind === "income" ? "Edit income" : "Edit expense")}

      {accounts.length === 0 ? (
        <p className="inline-alert error">Add an account first.</p>
      ) : (
        <form onSubmit={handleSubmit} className="transaction-form-grid">
          {editKind === "expense" && (
            <>
              <label className="form-field">
                <span>Date</span>
                <DatePicker value={date} onChange={setDate} />
              </label>
              <AccountSelect
                label="Spend from"
                value={fromAccountId}
                onChange={setFromAccountId}
                accounts={accounts}
                required
              />
              <CategorySelect
                kind="expense"
                category={category}
                subcategory={subcategory}
                categories={expenseCategories}
                transactions={transactions}
                onChange={handleCategoryChange}
                placeholder="Select category"
              />
              {showFromCurrencyPicker && (
                <CurrencySelect
                  value={currency}
                  onChange={setCurrency}
                  allowedCodes={fromCurrencyOptions}
                />
              )}
              <label className="form-field">
                <span>Amount</span>
                <div className="amount-input">
                  <span className="currency">{currencyInputPrefix(currency)}</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </label>
            </>
          )}

          {editKind === "income" && (
            <>
              <label className="form-field">
                <span>Date</span>
                <DatePicker value={date} onChange={setDate} />
              </label>
              <AccountSelect
                label="Add to account"
                value={toAccountId}
                onChange={setToAccountId}
                accounts={accounts}
                required
              />
              <CategorySelect
                kind="income"
                category={incomeCategory}
                subcategory={incomeSubcategory}
                categories={incomeCategories}
                transactions={transactions}
                onChange={handleIncomeCategoryChange}
                placeholder="Select category"
              />
              {showToCurrencyPicker && (
                <CurrencySelect
                  value={currency}
                  onChange={setCurrency}
                  allowedCodes={toCurrencyOptions}
                />
              )}
              <label className="form-field">
                <span>Amount</span>
                <div className="amount-input">
                  <span className="currency">{currencyInputPrefix(currency)}</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
              </label>
            </>
          )}

          <label className="form-field form-field-full">
            <span>Notes</span>
            <input
              type="text"
              placeholder="Optional notes or description"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="txn-form-footer modal-actions-footer modal-form-actions">
            <button
              type="submit"
              className={`submit-btn primary ${editKind}`}
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>

          {error && (
            <p className="inline-alert error form-row-alert" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </>
  )
}

export default EditTransactionModal
