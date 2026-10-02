import { useCallback, useMemo, useState } from "react"
import EditTransactionModal from "../components/EditTransactionModal"
import TransactionDetailModal from "../components/TransactionDetailModal"
import TransactionDeleteConfirmDialog from "../components/TransactionDeleteConfirmDialog"
import TransactionRowActions from "../components/TransactionRowActions"
import { deleteTransaction } from "../services/transferService"

export function useTransactionRowActions({
  transactions,
  accounts,
  profile,
  onUpdated,
}) {
  const [detailTransaction, setDetailTransaction] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [editFocusComplete, setEditFocusComplete] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const closeDeleteDialog = useCallback(() => {
    if (deleting) return
    setPendingDelete(null)
    setDeleteError("")
  }, [deleting])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return

    setDeleting(true)
    setDeleteError("")

    const { error } = await deleteTransaction(pendingDelete)

    setDeleting(false)

    if (error) {
      setDeleteError(error.message)
      return
    }

    setPendingDelete(null)
    onUpdated?.()
  }, [pendingDelete, onUpdated])

  const onView = useCallback((t) => setDetailTransaction(t), [])
  const onEdit = useCallback((target) => {
    setEditFocusComplete(false)
    setEditingTransaction(target)
  }, [])
  const onComplete = useCallback((target) => {
    setEditFocusComplete(true)
    setEditingTransaction(target)
  }, [])
  const onDelete = useCallback((target) => {
    setDeleteError("")
    setPendingDelete(target)
  }, [])

  const modals = (
    <>
      <TransactionDetailModal
        transaction={detailTransaction}
        accounts={accounts}
        allTransactions={transactions}
        onClose={() => setDetailTransaction(null)}
      />
      <EditTransactionModal
        transaction={editingTransaction}
        accounts={accounts}
        transactions={transactions}
        profile={profile}
        focusComplete={editFocusComplete}
        onClose={() => {
          setEditingTransaction(null)
          setEditFocusComplete(false)
        }}
        onSaved={() => onUpdated?.()}
      />
      <TransactionDeleteConfirmDialog
        open={Boolean(pendingDelete)}
        transaction={pendingDelete}
        allTransactions={transactions}
        accounts={accounts}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
        loading={deleting}
        error={deleteError}
      />
    </>
  )

  const getRowActionProps = useMemo(
    () => (transaction, summaryLabel) => ({
      transaction,
      allTransactions: transactions,
      summaryLabel,
      onView,
      onEdit,
      onComplete,
      onDelete,
    }),
    [transactions, onView, onEdit, onComplete, onDelete]
  )

  return { modals, getRowActionProps, TransactionRowActions }
}
