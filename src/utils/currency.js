import { getCurrencyMeta } from "../data/iso4217.js"

export function majorToMinor(major, currencyCode = "PHP") {
  const { decimals } = getCurrencyMeta(currencyCode)
  const factor = 10 ** decimals
  return Math.round(Number(major) * factor)
}

export function minorToMajor(minor, currencyCode = "PHP") {
  const { decimals } = getCurrencyMeta(currencyCode)
  const factor = 10 ** decimals
  return Number(minor) / factor
}

export function formatCurrency(amount, currencyCode = "PHP") {
  const code = (currencyCode || "PHP").toUpperCase()
  const n = Number(amount)
  if (!Number.isFinite(n)) return "—"

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: getCurrencyMeta(code).decimals,
    }).format(n)
  } catch {
    return `${code} ${n.toLocaleString()}`
  }
}

/** Magnitude in major units for stats (always positive). */
export function getTransactionMajorAbs(t) {
  if (t?.amount_minor != null) {
    const cur = t.currency || "PHP"
    return Math.abs(minorToMajor(t.amount_minor, cur))
  }
  return Math.abs(Number(t?.amount) || 0)
}

export function getTransactionCurrency(t) {
  return (t?.currency || "PHP").toUpperCase()
}

export function signedMinorForType(type, majorAbs, currencyCode) {
  const absMinor = Math.abs(majorToMinor(majorAbs, currencyCode))
  if (["income", "transfer_in", "transfer"].includes(type)) return absMinor
  if (["expense", "fee", "transfer_out"].includes(type)) return -absMinor
  return majorToMinor(Number(majorAbs), currencyCode)
}

export function parseSecondaryCurrencies(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String)
  return []
}

export function getPrimaryCurrency(profile, settings) {
  const fromSettings = settings?.base_currency?.trim()
  if (fromSettings) return fromSettings.toUpperCase()
  return (profile?.primary_currency || "PHP").toUpperCase()
}

/** True when value is a finite number strictly greater than zero. */
export function isPositiveMoneyAmount(value) {
  const n = Number(String(value ?? "").trim())
  return Number.isFinite(n) && n > 0
}

export function formatTransactionAmount(t, options = {}) {
  const { signed = false } = options
  const type = t?.type || "expense"
  const cur = getTransactionCurrency(t)
  const major = getTransactionMajorAbs(t)
  const text = formatCurrency(major, cur)

  if (!signed) return text

  if (type === "expense" || type === "fee" || type === "transfer_out") {
    return `−${text}`
  }
  if (type === "transfer") return `⇄ ${text}`
  return `+${text}`
}
