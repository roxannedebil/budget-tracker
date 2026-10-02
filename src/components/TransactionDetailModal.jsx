import { useEffect } from "react"
import ModalPortal from "./ModalPortal"
import { AccountsCell } from "./AccountLabel"
import Icon from "./icons/Icons"
import { formatCategoryLabel } from "../utils/categoryDisplay"
import {
  getFeeCategoryLabel,
  getNotesWithFeeContext,
  getTransferCategoryLabel,
} from "../utils/transactionDisplay"
import { formatDisplayDate } from "../utils/formatDate"
import { formatTransactionAmount, getTransactionCurrency } from "../utils/currency"
import {
  getTypeAmountClass,
  getTypeLabel,
  getTypePillClass,
} from "../utils/transactionDisplay"
import { useCurrency } from "../context/CurrencyContext"
import { getTransferFxDetails } from "../utils/transferFx"
import {
  getTransferKey,
  isGroupedTransfer,
  isLegacySingleTransfer,
} from "../utils/transferLifecycle"

function DetailRow({ label, children }) {
  return (
    <div className="txn-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function TransactionDetailModal({
  transaction,
  accounts,
  allTransactions = [],
  onClose,
}) {
  useEffect(() => {
    if (!transaction) return undefined

    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose()
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [transaction, onClose])

  const { primary } = useCurrency()

  if (!transaction) return null

  const type = transaction.type || "expense"
  const isTransferLike =
    type === "transfer" ||
    type === "transfer_out" ||
    type === "transfer_in" ||
    type === "fee" ||
    isGroupedTransfer(transaction) ||
    isLegacySingleTransfer(transaction) ||
    Boolean(getTransferKey(transaction))

  const fxDetails = isTransferLike
    ? getTransferFxDetails(transaction, allTransactions, { primary, accounts })
    : null
  const amountClass = getTypeAmountClass(type)
  const amountPrefix =
    type === "expense" || type === "fee" || type === "transfer_out"
      ? "−"
      : type === "income" || type === "transfer_in"
        ? "+"
        : "⇄"
  const txnId = transaction.transaction_id ?? transaction.id

  return (
    <ModalPortal>
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card txn-detail-modal"
        role="dialog"
        aria-labelledby="txn-detail-title"
        aria-modal="true"
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
            <span className={`type-pill type-${getTypePillClass(type)}`}>
              {getTypeLabel(transaction)}
            </span>
          </DetailRow>
          <DetailRow label="Amount">
            <span className={`txn-detail-amount ${amountClass}`}>
              {formatTransactionAmount(transaction, { signed: true })}
            </span>
          </DetailRow>
          <DetailRow label="Currency">{getTransactionCurrency(transaction)}</DetailRow>
          <DetailRow label="Category">
            {type === "fee"
              ? getFeeCategoryLabel()
              : type === "transfer" ||
                  type === "transfer_out" ||
                  type === "transfer_in"
                ? getTransferCategoryLabel(type, transaction.category)
                : formatCategoryLabel(
                    transaction.category,
                    transaction.subcategory
                  ) || "—"}
          </DetailRow>
          <DetailRow label="Account(s)">
            <AccountsCell
              t={transaction}
              accounts={accounts}
              allTransactions={allTransactions}
            />
          </DetailRow>
          <DetailRow label="Notes">
            {getNotesWithFeeContext(transaction, accounts, allTransactions)}
          </DetailRow>
          {fxDetails ? (
            <>
              <DetailRow label="Market estimate">
                {fxDetails.marketEstimateLabel ? (
                  <>
                    ≈ {fxDetails.marketEstimateLabel}
                    {fxDetails.status === "pending" ? (
                      <span className="muted txn-detail-inline-hint">
                        {" "}
                        (reference at send time)
                      </span>
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </DetailRow>
              {fxDetails.marketRateReferenceLabel &&
              fxDetails.rateLabel &&
              fxDetails.marketRateReferenceLabel !== fxDetails.rateLabel ? (
                <DetailRow label="Market rate (reference)">
                  {fxDetails.marketRateReferenceLabel}
                </DetailRow>
              ) : null}
              <DetailRow label="Rate you got">
                {fxDetails.rateLabel || "—"}
              </DetailRow>
            </>
          ) : null}
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
    </ModalPortal>
  )
}

export default TransactionDetailModal
