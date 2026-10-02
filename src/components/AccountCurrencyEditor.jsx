import { useState } from "react"
import { ISO4217_CURRENCIES } from "../data/iso4217"
import { parseAccountCurrencies } from "../utils/accountCurrencies"

function AccountCurrencyEditor({
  enabled,
  defaultCurrency,
  accountCurrencies,
  onChangeAccountCurrencies,
}) {
  const [addCode, setAddCode] = useState("")

  if (!enabled) return null

  const list = parseAccountCurrencies(accountCurrencies).filter(
    (c) => c !== defaultCurrency.toUpperCase()
  )

  const available = ISO4217_CURRENCIES.filter(
    (c) =>
      c.code !== defaultCurrency.toUpperCase() &&
      !list.includes(c.code)
  )

  return (
    <div className="form-field account-currency-editor">
      <span>Additional currencies</span>
      <p className="muted accounts-multi-hint">
        Default currency is {defaultCurrency.toUpperCase()}. Add other codes you use for
        this account.
      </p>
      {list.length === 0 ? (
        <p className="muted">None yet — add another currency.</p>
      ) : (
        <ul className="settings-secondary-list">
          {list.map((code) => (
            <li key={code}>
              <span>{code}</span>
              <button
                type="button"
                className="btn-sm ghost"
                onClick={() =>
                  onChangeAccountCurrencies(list.filter((c) => c !== code))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <div className="settings-secondary-add">
          <select value={addCode} onChange={(e) => setAddCode(e.target.value)}>
            <option value="">Search by code or name…</option>
            {available.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-sm"
            disabled={!addCode}
            onClick={() => {
              if (addCode) {
                onChangeAccountCurrencies([...list, addCode.toUpperCase()])
                setAddCode("")
              }
            }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  )
}

export default AccountCurrencyEditor
