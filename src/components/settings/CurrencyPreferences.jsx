import { useEffect, useMemo, useState } from "react"
import ConfirmDialog from "../ConfirmDialog"
import { FieldHint } from "../FormSection"
import { ISO4217_CURRENCIES } from "../../data/iso4217"
import { getDashboardSecondaryCurrencies } from "../../utils/accountCurrencies"
import { getCurrencyMeta } from "../../data/iso4217"
import { getBaseCurrency, saveBaseCurrency } from "../../utils/userSettings"

function CurrencyPreferences({
  profile,
  userSettings,
  accounts = [],
  transactions = [],
  onSaved,
}) {
  const savedPrimary = getBaseCurrency(userSettings, profile)
  const [primary, setPrimary] = useState(savedPrimary)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setPrimary(savedPrimary)
  }, [savedPrimary])

  const dashboardExtras = useMemo(
    () => getDashboardSecondaryCurrencies(accounts, primary, transactions),
    [accounts, primary, transactions]
  )

  const pendingChange = primary !== savedPrimary

  const handleSaveClick = () => {
    if (!pendingChange) return
    setConfirmOpen(true)
  }

  const handleConfirmSave = async () => {
    setSaving(true)
    setError("")
    setMessage("")

    const { error: updateError } = await saveBaseCurrency(profile.id, primary)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setConfirmOpen(false)
    setMessage("Primary currency updated. Totals use live rates; stored amounts are unchanged.")
    onSaved?.()
  }

  return (
    <div className="settings-currency-panel module-card card">
      <div className="card-header">
        <h2>Currencies</h2>
        <p className="muted settings-currency-hint">
          Used for your totals and as the default for new accounts. Your saved amounts
          are never changed. Add other currencies per account under Accounts → allow
          multiple currencies.
        </p>
      </div>

      <label className="form-field">
        <span>Primary currency</span>
        <select value={primary} onChange={(e) => setPrimary(e.target.value)}>
          {ISO4217_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="form-field">
        <span>Also on dashboard</span>
        <FieldHint>
          Shown as smaller lines under your totals (from accounts with extra currencies).
        </FieldHint>
        {dashboardExtras.length === 0 ? (
          <p className="muted">
            None yet. Edit an account, turn on multiple currencies, and add another code.
          </p>
        ) : (
          <ul className="settings-secondary-list settings-dashboard-currencies-readonly">
            {dashboardExtras.map((code) => (
              <li key={code}>
                <span>{code}</span>
                <span className="muted">native balance line</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="inline-alert error">{error}</p>}
      {message && <p className="inline-alert success">{message}</p>}

      <button
        type="button"
        className="auth-submit"
        disabled={saving || !pendingChange}
        onClick={handleSaveClick}
      >
        {saving ? "Saving…" : "Save primary currency"}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title="Change primary currency?"
        message={`Values will be shown in ${getCurrencyMeta(primary).code}. Your stored amounts are not changed.`}
        confirmLabel="Use this currency"
        onConfirm={handleConfirmSave}
        onCancel={() => setConfirmOpen(false)}
        loading={saving}
        error={error}
      />
    </div>
  )
}

export default CurrencyPreferences
