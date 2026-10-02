/** Frankfurter API base (v2). See https://frankfurter.dev */
export const FRANKFURTER_API_BASE = "https://api.frankfurter.dev"

export function buildFrankfurterRatesUrl({ base, quotes = [], date = null }) {
  const url = new URL(`${FRANKFURTER_API_BASE}/v2/rates`)
  url.searchParams.set("base", String(base).toLowerCase())
  const q = quotes.filter(Boolean).map((c) => String(c).toLowerCase())
  if (q.length) url.searchParams.set("quotes", q.join(","))
  if (date) url.searchParams.set("date", date)
  return url.href
}
