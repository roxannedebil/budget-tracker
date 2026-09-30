import { useEffect } from "react"
import { AccountsCell } from "./AccountLabel"
import Icon from "./icons/Icons"
import { formatCategoryLabel } from "../utils/categoryDisplay"
import { formatDisplayDate } from "../utils/formatDate"
import { formatMoney } from "../utils/transactionStats"
import { getTypeLabel } from "../utils/transactionDisplay"

function DetailRow({ label, children }) {
  return (
    <div className="txn-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function TransactionDetailModal({ transaction, accounts, onClose }) {
  useEffect(() => {
    if (!transaction) return

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [transaction, onClose])

  if (!transaction) return null

  const type = transaction.type || "expense"
  const amountClass =
    type === "expense"
      ? "expense-text"
      : type === "income"
        ? "income-text"
        : "transfer-text"
  const amountPrefix =
    type === "expense" ? "−" : type === "income" ? "+" : "⇄"
  const txnId = transaction.transaction_id ?? transaction.id

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card txn-detail-modal"
        role="dialog"
        aria-labelledby="txn-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="txn-detail-modal-head">
          <h2 id="txn-detail-title">Transaction details</h2>
          <button
            type="button"
            className="txn-detail-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <dl className="txn-detail-list">
          <DetailRow label="Date">
            {formatDisplayDate(transaction.date)}
          </DetailRow>
          <DetailRow label="Type">
            <span className={`type-pill type-${type}`}>
              {getTypeLabel(transaction)}
            </span>
          </DetailRow>
          <DetailRow label="Amount">
            <span className={`txn-detail-amount ${amountClass}`}>
              {amountPrefix}
              {formatMoney(transaction.amount)}
            </span>
          </DetailRow>
          <DetailRow label="Category">
            {formatCategoryLabel(transaction.category, transaction.subcategory)}
          </DetailRow>
          <DetailRow label="Account(s)">
            <AccountsCell t={transaction} accounts={accounts} />
          </DetailRow>
          <DetailRow label="Notes">
            {transaction.notes?.trim() ? transaction.notes : "—"}
          </DetailRow>
          {/* {txnId != null && (
            <DetailRow label="ID">
              <span className="txn-detail-id">{String(txnId)}</span>
            </DetailRow>
          )} */}
        </dl>

        <div className="txn-detail-modal-actions modal-form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TransactionDetailModal
