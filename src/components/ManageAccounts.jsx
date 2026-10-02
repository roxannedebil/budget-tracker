import { useEffect, useState } from "react"
import { supabase } from "../supabaseClient"
import {
  ACCOUNT_TYPES,
  getAccountIcon,
  getAccountTypeLabel,
} from "../utils/accounts"
import { formatMoney } from "../utils/transactionStats"
import AccountCurrencyEditor from "./AccountCurrencyEditor"
import CurrencySelect from "./CurrencySelect"
import { parseAccountCurrencies } from "../utils/accountCurrencies"
import { useCurrency } from "../context/CurrencyContext"
import Icon from "./icons/Icons"
import AccountColorPicker from "./AccountColorPicker"
import { AccountColorDot } from "./AccountLabel"
import {
  getAccountDisplayColor,
  normalizeAccountColorHex,
} from "../utils/accountColor"

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

function AccountFormFields({
  name,
  setName,
  accountType,
  setAccountType,
  colorHex,
  setColorHex,
  defaultCurrency,
  setDefaultCurrency,
  allowMulti,
  setAllowMulti,
  extraCurrencies,
  setExtraCurrencies,
  namePlaceholder = "e.g. BDO Payroll, GCash",
  previewAccount,
}) {
  const [settingsTab, setSettingsTab] = useState("currency")
  const previewName = (name || previewAccount?.name || "Account").trim() || "Account"
  const previewType = accountType || previewAccount?.account_type || "bank"
  const previewColor = getAccountDisplayColor({
    color_hex: colorHex,
    account_id: previewAccount?.account_id,
    name: previewName,
  })

  useEffect(() => {
    setSettingsTab("currency")
  }, [previewAccount?.account_id])

  return (
    <div className="accounts-modal-sections">
      {previewAccount && (
        <div
          className="accounts-modal-live-preview"
          style={{ "--account-color": previewColor }}
        >
          <span
            className="account-color-dot accounts-modal-preview-dot"
            style={{ background: previewColor }}
            aria-hidden="true"
          />
          <Icon name={getAccountIcon(previewType)} size={18} />
          <span className="accounts-modal-preview-name">{previewName}</span>
        </div>
      )}

      <section className="accounts-modal-section" aria-labelledby="accounts-section-details">
        <h3 id="accounts-section-details" className="accounts-modal-section-title">
          Details
        </h3>
        <label className="form-field accounts-modal-field">
          <span>Account name</span>
          <input
            type="text"
            placeholder={namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus={Boolean(previewAccount)}
          />
        </label>
        <div className="form-field accounts-modal-field">
          <span>Type</span>
          <AccountTypePicker value={accountType} onChange={setAccountType} />
        </div>
      </section>

      <div className="accounts-modal-tabs-wrap">
        <div className="accounts-modal-tabs" role="tablist" aria-label="Account settings">
          <button
            type="button"
            role="tab"
            id="accounts-tab-currency"
            aria-selected={settingsTab === "currency"}
            aria-controls="accounts-panel-currency"
            className={`accounts-modal-tab${settingsTab === "currency" ? " active" : ""}`}
            onClick={() => setSettingsTab("currency")}
          >
            Currency
          </button>
          <button
            type="button"
            role="tab"
            id="accounts-tab-color"
            aria-selected={settingsTab === "color"}
            aria-controls="accounts-panel-color"
            className={`accounts-modal-tab${settingsTab === "color" ? " active" : ""}`}
            onClick={() => setSettingsTab("color")}
          >
            Color
          </button>
        </div>

        <div
          id="accounts-panel-currency"
          role="tabpanel"
          aria-labelledby="accounts-tab-currency"
          className="accounts-modal-tabpanel"
          hidden={settingsTab !== "currency"}
        >
          <CurrencySelect
            label="Default currency"
            value={defaultCurrency}
            onChange={setDefaultCurrency}
          />
          <div className="accounts-modal-switch-row">
            <div className="accounts-modal-switch-copy">
              <span className="accounts-modal-switch-label">Multiple currencies</span>
              <p className="muted accounts-modal-switch-hint">
                Cash or wallets that hold more than one currency
              </p>
            </div>
            <input
              type="checkbox"
              className="accounts-modal-switch-input"
              checked={allowMulti}
              onChange={(e) => setAllowMulti(e.target.checked)}
              aria-label="Allow multiple currencies"
            />
          </div>
          {allowMulti && (
            <div className="accounts-modal-nested">
              <AccountCurrencyEditor
                enabled
                defaultCurrency={defaultCurrency}
                accountCurrencies={extraCurrencies}
                onChangeAccountCurrencies={setExtraCurrencies}
              />
            </div>
          )}
        </div>

        <div
          id="accounts-panel-color"
          role="tabpanel"
          aria-labelledby="accounts-tab-color"
          className="accounts-modal-tabpanel"
          hidden={settingsTab !== "color"}
        >
          <p className="muted accounts-modal-tabpanel-hint">
            Used on account cards and beside names in transactions.
          </p>
          <AccountColorPicker value={colorHex} onChange={setColorHex} />
        </div>
      </div>
    </div>
  )
}

export function AddAccountModal({ open, onClose, onSuccess }) {
  const { primary } = useCurrency()
  const [name, setName] = useState("")
  const [accountType, setAccountType] = useState("bank")
  const [allowMulti, setAllowMulti] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState(primary)
  const [extraCurrencies, setExtraCurrencies] = useState([])
  const [colorHex, setColorHex] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setAccountType("bank")
    setAllowMulti(false)
    setDefaultCurrency(primary)
    setExtraCurrencies([])
    setColorHex(null)
    setError("")
  }, [open, primary])

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
        allow_multiple_currencies: allowMulti,
        default_currency: defaultCurrency,
        account_currencies: allowMulti ? extraCurrencies : [],
        color_hex: normalizeAccountColorHex(colorHex),
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
          <AccountFormFields
            name={name}
            setName={setName}
            accountType={accountType}
            setAccountType={setAccountType}
            colorHex={colorHex}
            setColorHex={setColorHex}
            defaultCurrency={defaultCurrency}
            setDefaultCurrency={setDefaultCurrency}
            allowMulti={allowMulti}
            setAllowMulti={setAllowMulti}
            extraCurrencies={extraCurrencies}
            setExtraCurrencies={setExtraCurrencies}
          />

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
  const [allowMulti, setAllowMulti] = useState(false)
  const [defaultCurrency, setDefaultCurrency] = useState("PHP")
  const [extraCurrencies, setExtraCurrencies] = useState([])
  const [colorHex, setColorHex] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !account) return
    setName(account.name ?? "")
    setAccountType(account.account_type || "bank")
    setAllowMulti(Boolean(account.allow_multiple_currencies))
    setDefaultCurrency(account.default_currency || "PHP")
    setExtraCurrencies(parseAccountCurrencies(account.account_currencies))
    setColorHex(normalizeAccountColorHex(account.color_hex))
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
        allow_multiple_currencies: allowMulti,
        default_currency: defaultCurrency,
        account_currencies: allowMulti ? extraCurrencies : [],
        color_hex: normalizeAccountColorHex(colorHex),
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
              Name, color, and currency settings for this account.
            </p>
          </div>
        </div>

        <form className="accounts-add-modal-form" onSubmit={handleSubmit}>
          <AccountFormFields
            name={name}
            setName={setName}
            accountType={accountType}
            setAccountType={setAccountType}
            colorHex={colorHex}
            setColorHex={setColorHex}
            defaultCurrency={defaultCurrency}
            setDefaultCurrency={setDefaultCurrency}
            allowMulti={allowMulti}
            setAllowMulti={setAllowMulti}
            extraCurrencies={extraCurrencies}
            setExtraCurrencies={setExtraCurrencies}
            namePlaceholder="Account name"
            previewAccount={account}
          />

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
  const { primary } = useCurrency()
  if (!open || !account) return null

  const balance = Number(account.balance) || 0
  const balanceCurrency = (account.default_currency || primary).toUpperCase()

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
            <p className="accounts-delete-preview-name">
              <AccountColorDot account={account} />
              {account.name}
            </p>
            <p className="accounts-delete-preview-meta muted">
              {getAccountTypeLabel(account.account_type)}
            </p>
          </div>
          <p
            className={`accounts-delete-preview-balance ${balance >= 0 ? "positive" : "negative"}`}
          >
            {formatMoney(balance, balanceCurrency)}
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
