import { buildFrankfurterRatesUrl } from "./frankfurterConfig"

function toDateString(d) {
  return d.toISOString().slice(0, 10)
}

async function readFrankfurterError(res) {
  try {
    const json = await res.json()
    if (json?.message) return String(json.message)
    if (json?.status) return `HTTP ${json.status}`
  } catch {
    /* ignore */
  }
  return res.statusText || `HTTP ${res.status}`
}

/** v2 `/rates` returns a flat array: { date, base, quote, rate }[] */
function parseRatesRows(rows, fallbackBase, fallbackDate) {
  const list = Array.isArray(rows) ? rows : []
  const rates = {}
  let base = (fallbackBase || "").toUpperCase()
  let date = fallbackDate

  for (const row of list) {
    if (!row?.quote || row.rate == null) continue
    base = (row.base || base).toUpperCase()
    date = row.date || date
    rates[String(row.quote).toUpperCase()] = Number(row.rate)
  }

  return { base, date, rates }
}

async function fetchRatesUrl(url) {
  const res = await fetch(url)
  if (res.ok) {
    const json = await res.json()
    return { ok: true, rows: json }
  }

  const message = await readFrankfurterError(res)
  return { ok: false, status: res.status, message }
}

/**
 * Latest or historical rates for `baseCurrency` against `symbols`.
 * Historical: `?date=YYYY-MM-DD` on v2 `/rates` (Frankfurter docs).
 */
export async function fetchRatesForDate(baseCurrency, symbols, date) {
  const base = (baseCurrency || "PHP").toUpperCase()
  const targets = [
    ...new Set(
      (symbols || [])
        .map((s) => String(s).toUpperCase())
        .filter((s) => s && s !== base)
    ),
  ]

  if (targets.length === 0) {
    return { base, date: toDateString(date), rates: {} }
  }

  let cursor = new Date(date)

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const day = toDateString(cursor)
    const url = buildFrankfurterRatesUrl({ base, quotes: targets, date: day })
    const result = await fetchRatesUrl(url)

    if (result.ok) {
      const table = parseRatesRows(result.rows, base, day)
      if (Object.keys(table.rates).length > 0 || attempt === 0) {
        return table
      }
    }

    if (result.status === 422) {
      throw new Error(result.message || "Invalid currency for exchange rates.")
    }

    if (result.status === 404 || result.status === 400) {
      cursor.setDate(cursor.getDate() - 1)
      continue
    }

    throw new Error(result.message || "Could not load exchange rates.")
  }

  throw new Error("Could not load exchange rates for the requested date.")
}

export async function fetchLatestRates(baseCurrency, symbols) {
  return fetchRatesForDate(baseCurrency, symbols, new Date())
}
