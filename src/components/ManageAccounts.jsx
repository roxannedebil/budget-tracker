import { useEffect, useState } from "react"
import { supabase } from "../supabaseClient"
import {
  ACCOUNT_TYPES,
  getAccountIcon,
  getAccountTypeLabel,
} from "../utils/accounts"
import { formatMoney } from "../utils/transactionStats"
import Icon from "./icons/Icons"

export function AccountTypePicker({ value, onChange }) {
  return (
    <div className="accounts-type-picker" role="radiogroup" aria-label="Account type">
      {ACCOUNT_TYPES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          aria-checked={value === t.value}
          className={`accounts-type-option ${value === t.value ? "selected" : ""}`}
          onClick={() => onChange(t.value)}
        >
          <span className="accounts-type-option-icon" aria-hidden="true">
            <Icon name={t.icon} size={18} />
          </span>
          <span className="accounts-type-option-label">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

export function AddAccountModal({ open, onClose, onSuccess }) {
  const [name, setName] = useState("")
  const [accountType, setAccountType] = useState("bank")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setAccountType("bank")
    setError("")
  }, [open])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    setError("")

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: insertError } = await supabase.from("accounts").insert([
      {
        name: name.trim(),
        account_type: accountType,
        user_id: user?.id,
      },
    ])

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="modal-card accounts-add-modal"
        role="dialog"
        aria-labelledby="accounts-add-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="accounts-modal-head">
          <span className="accounts-modal-head-icon" aria-hidden="true">
            <Icon name="wallet" size={22} />
          </span>
          <div className="accounts-modal-head-text">
            <h2 id="accounts-add-modal-title">Add account</h2>
            <p className="muted accounts-add-modal-hint">
              Bank, E-Wallet, or cash — used when you record transactions.
            </p>
          </div>
        </div>

        <form className="accounts-add-modal-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Account name</span>
            <input
              type="text"
              placeholder="e.g. BDO Payroll, GCash"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>

          <div className="form-field">
            <span>Type</span>
            <AccountTypePicker value={accountType} onChange={setAccountType} />
          </div>

          {error && <p className="inline-alert error">{error}</p>}

          <div className="accounts-modal-footer modal-form-actions">
            <button
              type="submit"
              className="btn-sm accounts-btn-compact"
              disabled={submitting}
            >
              {submitting ? "Adding…" : "Add account"}
            </button>
            <button
              type="button"
              className="btn-secondary accounts-add-modal-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function EditAccountModal({ open, account, onClose, onSuccess }) {
  const [name, setName] = useState("")
  const [accountType, setAccountType] = useState("bank")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !account) return
    setName(account.name ?? "")
    setAccountType(account.account_type || "bank")
    setError("")
    setSubmitting(false)
  }, [open, account])

  if (!open || !account) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Account name cannot be empty.")
      return
    }

    setSubmitting(true)
    setError("")

    const { error: updateError } = await supabase
      .from("accounts")
      .update({
        name: trimmed,
        account_type: accountType,
      })
      .eq("account_id", account.account_id)

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="modal-card accounts-add-modal accounts-edit-modal"
        role="dialog"
        aria-labelledby="accounts-edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="accounts-modal-head">
          <span className="accounts-modal-head-icon" aria-hidden="true">
            <Icon name="pencil" size={22} />
          </span>
          <div className="accounts-modal-head-text">
            <h2 id="accounts-edit-modal-title">Edit account</h2>
            <p className="muted accounts-add-modal-hint">
              Update the name or type shown across the app.
            </p>
          </div>
        </div>

        <form className="accounts-add-modal-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Account name</span>
            <input
              type="text"
              placeholder="Account name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </label>

          <div className="form-field">
            <span>Type</span>
            <AccountTypePicker value={accountType} onChange={setAccountType} />
          </div>

          {error && <p className="inline-alert error">{error}</p>}

          <div className="accounts-modal-footer modal-form-actions">
            <button
              type="submit"
              className="btn-sm accounts-btn-compact"
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn-secondary accounts-add-modal-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DeleteAccountModal({
  open,
  account,
  loading = false,
  error,
  onConfirm,
  onCancel,
}) {
  if (!open || !account) return null

  const balance = Number(account.balance) || 0

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="modal-card accounts-add-modal accounts-delete-modal"
        role="alertdialog"
        aria-labelledby="accounts-delete-modal-title"
        aria-describedby="accounts-delete-modal-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="accounts-modal-head">
          <span
            className="accounts-modal-head-icon accounts-delete-modal-icon"
            aria-hidden="true"
          >
            <Icon name="alert-triangle" size={22} />
          </span>
          <div className="accounts-modal-head-text">
            <h2 id="accounts-delete-modal-title">Delete account?</h2>
            <p id="accounts-delete-modal-desc" className="muted accounts-add-modal-hint">
              Are you sure you want to delete this account? This cannot be undone.
            </p>
          </div>
        </div>

        <div className="accounts-delete-preview">
          <span className="accounts-delete-preview-icon" aria-hidden="true">
            <Icon name={getAccountIcon(account.account_type)} size={22} />
          </span>
          <div className="accounts-delete-preview-text">
            <p className="accounts-delete-preview-name">{account.name}</p>
            <p className="accounts-delete-preview-meta muted">
              {getAccountTypeLabel(account.account_type)}
            </p>
          </div>
          <p
            className={`accounts-delete-preview-balance ${balance >= 0 ? "positive" : "negative"}`}
          >
            {formatMoney(balance)}
          </p>
        </div>

        <p className="accounts-delete-note">
          <Icon name="check-circle" size={16} aria-hidden="true" />
          No transactions are linked to this account — safe to remove.
        </p>

        {error && <p className="inline-alert error">{error}</p>}

        <div className="accounts-modal-footer modal-form-actions">
          <button
            type="button"
            className="confirm-dialog-danger accounts-delete-confirm-btn"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete account"}
          </button>
          <button
            type="button"
            className="btn-secondary accounts-add-modal-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddAccountModal
