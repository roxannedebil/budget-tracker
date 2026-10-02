import { supabase } from "../../supabaseClient"
import { fetchRatesForDate } from "./frankfurterProvider"

const LS_PREFIX = "koinest_fx_cache_v1"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Dedupe concurrent getRatesTable calls (e.g. React StrictMode). */
const inflightRequests = new Map()

function cacheKey(userId, base) {
  return `${LS_PREFIX}:${userId || "anon"}:${base}`
}

function readLocalCache(userId, base) {
  try {
    const raw = localStorage.getItem(cacheKey(userId, base))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeLocalCache(userId, base, payload) {
  try {
    localStorage.setItem(cacheKey(userId, base), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

function cacheIsFresh(fetchedAt) {
  const t = Date.parse(fetchedAt)
  if (!Number.isFinite(t)) return false
  return Date.now() - t < CACHE_TTL_MS
}

function requestDedupeKey({ userId, base, wanted, asOfDate, forceRefresh }) {
  const day = asOfDate instanceof Date ? asOfDate.toISOString().slice(0, 10) : "today"
  return `${userId || ""}|${base}|${wanted.slice().sort().join(",")}|${day}|${forceRefresh ? "1" : "0"}`
}

/** 1 unit of `from` → how many `to`, using table where base is primary. */
export function convertMajor(amount, from, to, table) {
  const n = Number(amount)
  if (!Number.isFinite(n) || from === to) return n
  if (!table?.rates) return NaN

  const base = table.base
  const rates = table.rates

  if (from === base && rates[to] != null) return n * rates[to]
  if (to === base && rates[from] != null) return n / rates[from]

  const inBase = from === base ? n : n / rates[from]
  if (to === base) return inBase
  if (rates[to] != null) return inBase * rates[to]
  return NaN
}

async function getRatesTableInner({
  userId,
  baseCurrency,
  symbols = [],
  asOfDate = new Date(),
  forceRefresh = false,
}) {
  const base = (baseCurrency || "PHP").toUpperCase()
  const wanted = [...new Set(symbols.map((s) => s.toUpperCase()).filter((s) => s && s !== base))]
  const nowIso = new Date().toISOString()

  if (!forceRefresh) {
    const local = readLocalCache(userId, base)
    if (local?.table && cacheIsFresh(local.fetched_at)) {
      return { table: local.table, source: "local", fetched_at: local.fetched_at }
    }
  }

  if (userId && !forceRefresh) {
    const dayStr = asOfDate.toISOString().slice(0, 10)
    const { data } = await supabase
      .from("user_fx_rate_cache")
      .select("rates, as_of_date, fetched_at")
      .eq("user_id", userId)
      .eq("base_currency", base)
      .eq("as_of_date", dayStr)
      .maybeSingle()

    if (data?.rates?.base && cacheIsFresh(data.fetched_at)) {
      const table = data.rates
      writeLocalCache(userId, base, { table, fetched_at: data.fetched_at || nowIso })
      return { table, source: "supabase", fetched_at: data.fetched_at || nowIso }
    }
  }

  try {
    const table = await fetchRatesForDate(base, wanted, asOfDate)
    const payload = { table, fetched_at: nowIso }
    writeLocalCache(userId, base, payload)

    if (userId) {
      await supabase.from("user_fx_rate_cache").upsert(
        {
          user_id: userId,
          base_currency: base,
          as_of_date: table.date,
          rates: table,
          provider: "frankfurter",
          fetched_at: payload.fetched_at,
        },
        { onConflict: "user_id,base_currency,as_of_date" }
      )
    }

    return { table, source: "network", fetched_at: payload.fetched_at }
  } catch (err) {
    const stale = readLocalCache(userId, base)
    if (stale?.table) {
      return {
        table: stale.table,
        source: "offline",
        fetched_at: stale.fetched_at,
        error: err,
      }
    }
    return {
      table: null,
      source: "unavailable",
      fetched_at: null,
      error: err,
    }
  }
}

export async function getRatesTable(options) {
  const key = requestDedupeKey({
    userId: options.userId,
    base: (options.baseCurrency || "PHP").toUpperCase(),
    wanted: [
      ...new Set(
        (options.symbols || [])
          .map((s) => s.toUpperCase())
          .filter((s) => s && s !== (options.baseCurrency || "PHP").toUpperCase())
      ),
    ],
    asOfDate: options.asOfDate,
    forceRefresh: options.forceRefresh,
  })

  if (!options.forceRefresh && inflightRequests.has(key)) {
    return inflightRequests.get(key)
  }

  const promise = getRatesTableInner(options).finally(() => {
    inflightRequests.delete(key)
  })

  inflightRequests.set(key, promise)
  return promise
}

const SOURCE_LABELS = {
  network: "Frankfurter",
  supabase: "Frankfurter",
  local: "cached Frankfurter",
  offline: "cached Frankfurter",
}

/** Market quote for cross-currency transfer UI; null if no rate available. */
export async function getMarketTransferQuote({
  userId,
  primary,
  fromCurrency,
  toCurrency,
  sendMajor,
}) {
  const from = (fromCurrency || "PHP").toUpperCase()
  const to = (toCurrency || "PHP").toUpperCase()
  const send = Number(sendMajor)
  if (!Number.isFinite(send) || send <= 0 || from === to) return null

  const result = await getRatesTable({
    userId,
    baseCurrency: primary,
    symbols: [from, to],
  })

  const table = result.table
  const source = SOURCE_LABELS[result.source] || "Frankfurter"
  const fetchedAt = result.fetched_at
  if (!table?.rates) return null

  const estimateMajor = convertMajor(send, from, to, table)
  const recvPerSend = convertMajor(1, from, to, table)
  if (!Number.isFinite(estimateMajor) || !Number.isFinite(recvPerSend)) return null

  return {
    estimateMajor,
    recvPerSend,
    source,
    fetchedAt,
  }
}

export async function getMarketEstimate({
  userId,
  primary,
  fromCurrency,
  toCurrency,
  sendMajor,
}) {
  if (!sendMajor || fromCurrency === toCurrency) return sendMajor
  const quote = await getMarketTransferQuote({
    userId,
    primary,
    fromCurrency,
    toCurrency,
    sendMajor,
  })
  return quote?.estimateMajor ?? null
}
