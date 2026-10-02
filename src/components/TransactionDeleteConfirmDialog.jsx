import { useEffect, useMemo } from "react"
import ModalPortal from "./ModalPortal"
import { AccountsCell } from "./AccountLabel"
import {
  getTransactionCategoryCell,
  getTypeLabel,
  getTypePillClass,
} from "../utils/transactionDisplay"
import { formatDisplayDate } from "../utils/formatDate"
import { formatTransactionAmount } from "../utils/currency"
import {
  getDeleteBalanceImpactLines,
  getTransactionsForDelete,
} from "../utils/transactionDeletePreview"

function TransactionDeleteConfirmDialog({
  open,
  transaction,
  allTransactions = [],
  accounts = [],
  onConfirm,
  onCancel,
  loading = false,
  error,
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !loading) onCancel?.()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open, loading, onCancel])

  const affectedRows = useMemo(
    () =>
      transaction
        ? getTransactionsForDelete(transaction, allTransactions)
        : [],
    [transaction, allTransactions]
  )

  const balanceLines = useMemo(
    () => getDeleteBalanceImpactLines(affectedRows, accounts),
    [affectedRows, accounts]
  )

  if (!open || !transaction) return null

  return (
    <ModalPortal>
      <div
        className="modal-overlay confirm-dialog-overlay txn-delete-confirm-overlay"
        role="presentation"
        onClick={loading ? undefined : onCancel}
      >
        <div
          className="modal-card confirm-dialog txn-delete-confirm-dialog"
          role="alertdialog"
          aria-labelledby="txn-delete-confirm-title"
          aria-describedby="txn-delete-confirm-desc"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="txn-delete-confirm-title">Delete Transaction?</h2>
          <p id="txn-delete-confirm-desc" className="txn-delete-confirm-lead">
            The following transaction(s) will be deleted:
          </p>

          <div className="txn-delete-confirm-table-wrap">
            <table className="txn-delete-confirm-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th className="col-amount">Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {affectedRows.map((row) => {
                  const rowKey = row.transaction_id ?? row.id
                  const category = getTransactionCategoryCell(row, accounts, {
                    allTransactions,
                  })
                  return (
                    <tr key={rowKey}>
                      <td>
                        <span
                          className={`type-pill type-${getTypePillClass(row.type)}`}
                        >
                          {getTypeLabel(row)}
                        </span>
                      </td>
                      <td className="txn-delete-confirm-account">
                        <AccountsCell
                          t={row}
                          accounts={accounts}
                          allTransactions={allTransactions}
                        />
                      </td>
                      <td className="txn-delete-confirm-category">{category}</td>
                      <td className="col-amount">
                        {formatTransactionAmount(row, { signed: true })}
                      </td>
                      <td className="txn-delete-confirm-date">
                        {formatDisplayDate(row.date)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <section className="txn-delete-confirm-balance" aria-labelledby="txn-delete-balance-heading">
            <h3 id="txn-delete-balance-heading">Balance Impact</h3>
            {balanceLines.length > 0 ? (
              <ul className="txn-delete-confirm-balance-list">
                {balanceLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="muted compact-hint">No balance change on your accounts.</p>
            )}
          </section>

          <p className="txn-delete-confirm-warning">
            <strong>This action cannot be undone.</strong>
          </p>

          <div
            className={`confirm-dialog-error-slot${error ? " has-error" : ""}`}
            aria-live="polite"
          >
            {error ? <p className="inline-alert error">{error}</p> : null}
          </div>

          <div className="confirm-dialog-actions modal-form-actions txn-delete-confirm-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="confirm-dialog-danger"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Please wait…" : "Delete Transaction"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

export default TransactionDeleteConfirmDialog
