import { ISO4217_CURRENCIES } from "../data/iso4217"

function CurrencySelect({
  value,
  onChange,
  id,
  label = "Currency",
  disabled = false,
  allowedCodes = null,
}) {
  const allowed = allowedCodes?.length
    ? ISO4217_CURRENCIES.filter((c) =>
        allowedCodes.map((x) => x.toUpperCase()).includes(c.code)
      )
    : ISO4217_CURRENCIES

  return (
    <label className="form-field">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || allowed.length <= 1}
      >
        {allowed.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
    </label>
  )
}

export default CurrencySelect
