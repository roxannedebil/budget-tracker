import { getAccountById } from "../utils/accounts"
import { getAccountDisplayColor } from "../utils/accountColor"
import { AccountColorDot } from "./AccountLabel"

function AccountSelect({
  label,
  value,
  onChange,
  accounts,
  required = false,
  placeholder = "Select account",
  disabledOption,
  className = "",
  id,
}) {
  const selected = getAccountById(accounts, value)
  const swatchColor = selected ? getAccountDisplayColor(selected) : "var(--border)"

  return (
    <label className={`form-field account-select-field ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <div className="account-select-control">
        <span
          className="account-select-swatch"
          style={{ background: swatchColor }}
          aria-hidden="true"
        />
        <select
          id={id}
          className="account-select-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        >
          <option value="">{placeholder}</option>
          {accounts.map((a) => {
            const disabled =
              typeof disabledOption === "function"
                ? disabledOption(a)
                : false
            return (
              <option key={a.account_id} value={a.account_id} disabled={disabled}>
                {a.name}
              </option>
            )
          })}
        </select>
      </div>
    </label>
  )
}

/** Inline account name with color dot (recap, headers). */
export function AccountNameWithColor({
  account,
  accounts,
  id,
  className = "",
  nameClassName = "",
}) {
  const resolved = account ?? getAccountById(accounts, id)
  if (!resolved) {
    return <span className={nameClassName}>—</span>
  }
  return (
    <span className={`account-name-with-color ${className}`.trim()}>
      <AccountColorDot account={resolved} />
      <span className={nameClassName || undefined}>{resolved.name}</span>
    </span>
  )
}

export default AccountSelect
