import { formatCurrency, minorToMajor } from "../utils/currency"

/** One or more balance lines per currency bucket (never mixes USD + PHP into one number). */
function AccountBalanceLines({ account, valueClassName = "" }) {
  const buckets = account?.balanceByCurrency || {}
  const defaultCur = (account?.default_currency || "PHP").toUpperCase()

  const lines = Object.entries(buckets)
    .map(([cur, minor]) => ({
      cur: cur.toUpperCase(),
      major: minorToMajor(minor, cur),
    }))
    .filter((l) => l.major !== 0)
    .sort((a, b) => a.cur.localeCompare(b.cur))

  if (lines.length === 0) {
    return (
      <span className={`${valueClassName} positive`}>
        {formatCurrency(0, defaultCur)}
      </span>
    )
  }

  return (
    <div className="account-balance-lines">
      {lines.map((l) => (
        <span
          key={l.cur}
          className={`account-balance-line ${valueClassName} ${l.major >= 0 ? "positive" : "negative"}`}
        >
          {formatCurrency(l.major, l.cur)}
        </span>
      ))}
    </div>
  )
}

export default AccountBalanceLines
