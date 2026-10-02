import { useEffect, useState } from "react"
import { ISO4217_CURRENCIES } from "../data/iso4217"
import { guessCurrencyFromLocale } from "../utils/localeCurrency"
import { saveBaseCurrency } from "../utils/userSettings"

function PrimaryCurrencySetupModal({ open, userId, onComplete }) {
  const [code, setCode] = useState(() => guessCurrencyFromLocale("PHP"))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (open) setCode(guessCurrencyFromLocale("PHP"))
  }, [open])

  if (!open) return null

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError("")

    const { error: saveError } = await saveBaseCurrency(userId, code, {
      markSetupComplete: true,
    })

    setSaving(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    onComplete?.()
  }

  return (
    <div className="modal-overlay currency-setup-overlay" role="presentation">
      <div
        className="modal-card currency-setup-modal"
        role="dialog"
        aria-labelledby="currency-setup-title"
      >
        <h2 id="currency-setup-title">Choose your primary currency</h2>
        <p className="muted currency-setup-lead">
          Used for net worth and combined totals, and as the default for new accounts.
          Each transaction and account balance still shows in its saved currency.
        </p>

        <form onSubmit={handleSave}>
          <label className="form-field">
            <span>Primary currency</span>
            <select value={code} onChange={(e) => setCode(e.target.value)} required>
              {ISO4217_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="inline-alert error">{error}</p>}

          <div className="modal-form-actions">
            <button type="submit" className="auth-submit" disabled={saving}>
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default PrimaryCurrencySetupModal
