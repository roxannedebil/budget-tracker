import { useState } from "react"
import { supabase } from "../supabaseClient"
import { ACCOUNT_TYPES, getAccountIcon } from "../utils/accounts"
import { isAccountInUse } from "../utils/accountUsage"

function ManageAccounts({ accounts, transactions, onUpdate }) {
  const [name, setName] = useState("")
  const [accountType, setAccountType] = useState("bank")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState("")

  const handleAdd = async (e) => {
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

    setName("")
    onUpdate()
  }

  const startEdit = (account) => {
    setEditingId(account.account_id)
    setEditName(account.name)
    setError("")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName("")
  }

  const saveEdit = async (accountId) => {
    const trimmed = editName.trim()
    if (!trimmed) {
      setError("Account name cannot be empty.")
      return
    }

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ name: trimmed })
      .eq("account_id", accountId)

    if (updateError) {
      setError(updateError.message)
      return
    }

    cancelEdit()
    onUpdate()
  }

  const handleDelete = async (accountId) => {
    if (isAccountInUse(accountId, transactions)) {
      setError("Cannot delete — this account has transactions.")
      return
    }

    const { error: deleteError } = await supabase
      .from("accounts")
      .delete()
      .eq("account_id", accountId)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    onUpdate()
  }

  return (
    <details className="card collapsible" open={accounts.length === 0}>
      <summary className="collapsible-summary">
        <h2>Accounts</h2>
        <span className="chip">{accounts.length}</span>
      </summary>

      <div className="collapsible-body">
        {accounts.length > 0 ? (
          <ul className="account-chips">
            {accounts.map((account) => {
              const inUse = isAccountInUse(account.account_id, transactions)
              const isEditing = editingId === account.account_id

              return (
                <li key={account.account_id} className="account-chip">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        className="account-edit-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(account.account_id)
                          if (e.key === "Escape") cancelEdit()
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="chip-action save"
                        onClick={() => saveEdit(account.account_id)}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="chip-action"
                        onClick={cancelEdit}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span>
                        {getAccountIcon(account.account_type)} {account.name}
                      </span>
                      <button
                        type="button"
                        className="chip-action"
                        onClick={() => startEdit(account)}
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => handleDelete(account.account_id)}
                        disabled={inUse}
                        title={
                          inUse
                            ? "Has transactions — cannot delete"
                            : "Delete account"
                        }
                        aria-label={`Remove ${account.name}`}
                      >
                        ×
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted compact-hint">
            Add your payroll bank, e-wallets, and cash first.
          </p>
        )}

        <form className="account-form" onSubmit={handleAdd}>
          <input
            type="text"
            placeholder="Name (e.g. BDO Payroll, GCash)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-sm" disabled={submitting}>
            {submitting ? "…" : "Add"}
          </button>
        </form>

        {error && <p className="inline-alert error">{error}</p>}
      </div>
    </details>
  )
}

export default ManageAccounts
