import Icon from "./icons/Icons"
import { getTransactionDeleteSummary } from "../utils/transactionDelete"
import {
  canEditTransactionRow,
  isLinkedTransferFee,
  isPendingTransferGroup,
  resolveTransferActionTarget,
} from "../utils/transferLifecycle"

const ICON_SIZE = 16

function TransactionRowActions({
  transaction,
  allTransactions = [],
  onView,
  onEdit,
  onDelete,
  onComplete,
  summaryLabel,
}) {
  const actionTarget = resolveTransferActionTarget(transaction, allTransactions)
  const showComplete =
    actionTarget &&
    !isLinkedTransferFee(transaction) &&
    isPendingTransferGroup(actionTarget, allTransactions)
  const showEdit = canEditTransactionRow(transaction, allTransactions)
  const editIsPendingTransfer =
    actionTarget &&
    isPendingTransferGroup(actionTarget, allTransactions)
  const summary =
    summaryLabel ?? getTransactionDeleteSummary(transaction)

  return (
    <div className="txn-row-actions txn-row-actions-icons">
      {showComplete && (
        <button
          type="button"
          className="txn-icon-action txn-icon-action-complete"
          onClick={() => onComplete?.(actionTarget)}
          title="Mark transfer complete"
          aria-label={`Complete pending transfer ${summary}`}
        >
          <Icon name="check" size={ICON_SIZE} />
        </button>
      )}
      <button
        type="button"
        className="txn-icon-action txn-icon-action-view"
        onClick={() => onView?.(transaction)}
        title="View details"
        aria-label={`View details for ${summary}`}
      >
        <Icon name="eye" size={ICON_SIZE} />
      </button>
      {showEdit && (
        <button
          type="button"
          className="txn-icon-action txn-icon-action-edit"
          onClick={() => onEdit?.(actionTarget ?? transaction)}
          title={
            editIsPendingTransfer ? "Edit pending transfer" : "Edit transaction"
          }
          aria-label={
            editIsPendingTransfer
              ? `Edit pending transfer ${summary}`
              : `Edit transaction ${summary}`
          }
        >
          <Icon name="pencil" size={ICON_SIZE} />
        </button>
      )}
      <button
        type="button"
        className="txn-icon-action txn-icon-action-delete"
        onClick={() =>
          onDelete?.(
            resolveTransferActionTarget(transaction, allTransactions) ??
              transaction
          )
        }
        title={
          isLinkedTransferFee(transaction)
            ? "Delete whole transfer (including fee)"
            : "Delete transaction"
        }
        aria-label={`Delete transaction ${summary}`}
      >
        <Icon name="trash" size={ICON_SIZE} />
      </button>
    </div>
  )
}

export default TransactionRowActions
