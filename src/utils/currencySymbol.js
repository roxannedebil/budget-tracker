import { formatCurrency } from "./currency"

/** Prefix for amount inputs (e.g. $, ₱) from ISO code — not hardcoded PHP. */
export function currencyInputPrefix(currencyCode) {
  const code = (currencyCode || "PHP").toUpperCase()
  const sample = formatCurrency(0, code)
  const prefix = sample.replace(/[\d.,\s0\-]/g, "").trim()
  return prefix || code
}

export function formatChartTick(value, currencyCode = "PHP") {
  const n = Number(value)
  if (!Number.isFinite(n)) return ""
  const prefix = currencyInputPrefix(currencyCode)
  if (Math.abs(n) >= 1000) {
    return `${prefix}${(n / 1000).toFixed(0)}k`
  }
  return formatCurrency(n, currencyCode)
}
