import "../App.css"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../supabaseClient"
import ConfirmDialog from "./ConfirmDialog"
import EditTransactionModal from "./EditTransactionModal"
import {
  FilterDropdown,
  FilterTriggerButton,
} from "./TransactionFilterPanel"
import { formatDisplayDate } from "../utils/formatDate"
import { formatAccountsCell, getTypeLabel } from "../utils/transactionDisplay"
import {
  filterTransactions,
  getDefaultFilters,
  hasActiveFilters,
  paginateItems,
} from "../utils/transactionFilters"
import {
  getColumnDef,
  loadColumnOrder,
  nextSortDirection,
  saveColumnOrder,
  sortTransactions,
} from "../utils/transactionTable"
import { getTransactionDeleteSummary } from "../utils/transactionDelete"

const PAGE_SIZES = [10, 25, 50]

function getTypeBadgeClass(type) {
  if (type === "expense") return "expense"
  if (type === "transfer") return "transfer"
  return "income"
}

function getAmountClass(type) {
  if (type === "expense") return "expense-text"
  if (type === "transfer") return "transfer-text"
  return "income-text"
}

function getAmountPrefix(type) {
  if (type === "expense") return "−"
  if (type === "transfer") return "⇄"
  return "+"
}

function TransactionList({ transactions, accounts, onUpdated }) {
  const [filters, setFilters] = useState(getDefaultFilters)
  const [draftFilters, setDraftFilters] = useState(getDefaultFilters)
  const [filterOpen, setFilterOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [columnOrder, setColumnOrder] = useState(loadColumnOrder)
  const [sort, setSort] = useState({ column: "date", direction: "desc" })
  const [dragColumn, setDragColumn] = useState(null)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")
  const filterWrapRef = useRef(null)

  const filtered = useMemo(
    () => filterTransactions(transactions, accounts, filters),
    [transactions, accounts, filters]
  )

  const sorted = useMemo(
    () => sortTransactions(filtered, accounts, sort),
    [filtered, accounts, sort]
  )

  const pagination = useMemo(
    () => paginateItems(sorted, page, pageSize),
    [sorted, page, pageSize]
  )

  const orderedColumns = useMemo(
    () => columnOrder.map((id) => getColumnDef(id)).filter(Boolean),
    [columnOrder]
  )

  useEffect(() => {
    setPage(1)
  }, [filters, pageSize, transactions.length, sort])

  useEffect(() => {
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages)
    }
  }, [page, pagination.totalPages])

  useEffect(() => {
    saveColumnOrder(columnOrder)
  }, [columnOrder])

  useEffect(() => {
    if (!filterOpen) return

    const handleClick = (e) => {
      if (filterWrapRef.current && !filterWrapRef.current.contains(e.target)) {
        setFilterOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [filterOpen])

  const openFilters = () => {
    setDraftFilters(filters)
    setFilterOpen(true)
  }

  const applyFilters = () => {
    setFilters(draftFilters)
    setFilterOpen(false)
  }

  const clearFilters = () => {
    const empty = getDefaultFilters()
    setDraftFilters(empty)
    setFilters(empty)
    setFilterOpen(false)
  }

  const handleSort = (columnId) => {
    setSort((prev) => ({
      column: columnId,
      direction: nextSortDirection(prev, columnId),
    }))
  }

  const handleDrop = (targetId) => {
    if (!dragColumn || dragColumn === targetId) return

    setColumnOrder((order) => {
      const next = [...order]
      const from = next.indexOf(dragColumn)
      const to = next.indexOf(targetId)
      if (from < 0 || to < 0) return order
      next.splice(from, 1)
      next.splice(to, 0, dragColumn)
      return next
    })
    setDragColumn(null)
  }

  const closeDeleteDialog = () => {
    if (deleting) return
    setPendingDelete(null)
    setDeleteError("")
  }

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return

    const id = pendingDelete.transaction_id ?? pendingDelete.id
    if (!id) {
      setDeleteError("Could not identify this transaction.")
      return
    }

    setDeleting(true)
    setDeleteError("")

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("transaction_id", id)

    setDeleting(false)

    if (error) {
      setDeleteError(error.message)
      return
    }

    setPendingDelete(null)
    onDeleted?.()
  }

  if (transactions.length === 0) {
    return (
      <div className="transaction-list card section-card">
        <div className="card-header">
          <h2>Transactions</h2>
        </div>
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <p>No transactions yet</p>
          <span className="empty-hint">
            Add accounts, then record income, expenses, or transfers
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="transaction-list card section-card">
      <div className="card-header">
        <h2>Transactions</h2>
        <div className="table-header-actions">
          <div className="filter-wrap" ref={filterWrapRef}>
            <FilterTriggerButton
              active={hasActiveFilters(filters)}
              open={filterOpen}
              onClick={() => (filterOpen ? setFilterOpen(false) : openFilters())}
            />
            {filterOpen && (
              <FilterDropdown
                filters={draftFilters}
                onChange={setDraftFilters}
                onClear={clearFilters}
                onApply={applyFilters}
              />
            )}
          </div>
          <span className="transaction-count">
            {filtered.length} of {transactions.length}
          </span>
        </div>
      </div>

      <p className="table-hint muted">
        Drag ⠿ to reorder columns · Click header to sort
      </p>

      <div className="table-wrap">
        <table className="transaction-table">
          <thead>
            <tr>
              {orderedColumns.map((col) => (
                <th
                  key={col.id}
                  className={`sortable-th ${col.align === "right" ? "col-amount" : ""} ${sort.column === col.id ? `sorted-${sort.direction}` : ""} ${dragColumn === col.id ? "dragging" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(col.id)}
                >
                  <div className="th-inner">
                    <span
                      className="drag-handle"
                      draggable
                      onDragStart={() => setDragColumn(col.id)}
                      onDragEnd={() => setDragColumn(null)}
                      title="Drag to reorder"
                    >
                      ⠿
                    </span>
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                      <span className="sort-indicator">
                        {sort.column === col.id
                          ? sort.direction === "asc"
                            ? "↑"
                            : "↓"
                          : ""}
                      </span>
                    </button>
                  </div>
                </th>
              ))}
              <th className="col-actions" aria-label="Actions" />
            </tr>
          </thead>

          <tbody>
            {pagination.items.length === 0 ? (
              <tr>
                <td colSpan={orderedColumns.length + 1} className="no-results">
                  No transactions match your filters.
                </td>
              </tr>
            ) : (
              pagination.items.map((t) => (
                <tr key={t.transaction_id ?? t.id}>
                  {orderedColumns.map((col) => (
                    <Cell
                      key={col.id}
                      t={t}
                      columnId={col.id}
                      accounts={accounts}
                    />
                  ))}
                  <td className="col-actions">
                    <div className="txn-row-actions">
                      <button
                        type="button"
                        className="txn-edit-btn"
                        onClick={() => setEditingTransaction(t)}
                        title="Edit transaction"
                        aria-label={`Edit transaction ${getTransactionDeleteSummary(t)}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="txn-delete-btn"
                        onClick={() => {
                          setDeleteError("")
                          setPendingDelete(t)
                        }}
                        title="Delete transaction"
                        aria-label={`Delete transaction ${getTransactionDeleteSummary(t)}`}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <EditTransactionModal
        transaction={editingTransaction}
        accounts={accounts}
        transactions={transactions}
        onClose={() => setEditingTransaction(null)}
        onSaved={onUpdated}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete transaction?"
        message={
          pendingDelete
            ? `This cannot be undone. You are about to delete: ${getTransactionDeleteSummary(pendingDelete)}`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Keep transaction"
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteDialog}
        loading={deleting}
        danger
        error={deleteError}
      />

      <div className="table-pagination">
        <span className="pagination-info">
          {pagination.total === 0
            ? "No results"
            : `Showing ${pagination.start}–${pagination.end} of ${pagination.total}`}
        </span>

        <div className="pagination-controls">
          <label className="page-size-label">
            Rows
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="btn-sm ghost"
            disabled={pagination.page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>
          <span className="page-indicator">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn-sm ghost"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

function Cell({ t, columnId, accounts }) {
  switch (columnId) {
    case "date":
      return <td className="col-date">{formatDisplayDate(t.date)}</td>
    case "accounts":
      return (
        <td className="col-accounts">{formatAccountsCell(t, accounts)}</td>
      )
    case "category":
      return (
        <td className="col-category">
          <span className="category-name">{t.category}</span>
        </td>
      )
    case "notes":
      return <td className="col-notes">{t.notes || "—"}</td>
    case "type":
      return (
        <td>
          <span className={`badge ${getTypeBadgeClass(t.type)}`}>
            {getTypeLabel(t)}
          </span>
        </td>
      )
    case "amount":
      return (
        <td className={`col-amount amount ${getAmountClass(t.type)}`}>
          {getAmountPrefix(t.type)}₱
          {Number(t.amount).toLocaleString()}
        </td>
      )
    default:
      return <td />
  }
}

export default TransactionList
