import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { getDashboardSecondaryCurrencies } from "../utils/accountCurrencies"
import { formatCurrency } from "../utils/currency"
import { getBaseCurrency } from "../utils/userSettings"
import { getRatesTable } from "../services/rates/ratesService"

const CurrencyContext = createContext(null)

/** Always fetch these so dashboard can convert common transaction currencies. */
const COMMON_FX_CODES = ["USD", "EUR", "GBP", "JPY", "AUD", "SGD", "HKD", "CAD"]

export function CurrencyProvider({
  userId,
  profile,
  userSettings,
  accounts = [],
  transactions = [],
  children,
}) {
  const primary = getBaseCurrency(userSettings, profile)
  const secondaries = useMemo(
    () => getDashboardSecondaryCurrencies(accounts, primary, transactions),
    [accounts, primary, transactions]
  )

  const [ratesTable, setRatesTable] = useState(null)
  const [ratesMeta, setRatesMeta] = useState({ loading: false, source: null, error: null })
  const fetchGen = useRef(0)

  const symbols = useMemo(() => {
    const set = new Set([...COMMON_FX_CODES, ...secondaries, primary])
    return [...set]
  }, [primary, secondaries])

  const symbolsKey = useMemo(() => symbols.slice().sort().join(","), [symbols])

  useEffect(() => {
    if (!userId) return

    const gen = ++fetchGen.current
    const symbolList = symbolsKey ? symbolsKey.split(",") : [primary]

    async function load() {
      setRatesMeta((m) => ({ ...m, loading: true, error: null }))
      try {
        const result = await getRatesTable({
          userId,
          baseCurrency: primary,
          symbols: symbolList,
          forceRefresh: false,
        })
        if (gen !== fetchGen.current) return

        setRatesTable(result.table || null)
        const errMsg =
          result.error instanceof Error
            ? result.error.message
            : result.error
              ? String(result.error)
              : null
        setRatesMeta({
          loading: false,
          source: result.source,
          error: result.table ? null : errMsg,
        })
      } catch (err) {
        if (gen !== fetchGen.current) return
        setRatesTable(null)
        setRatesMeta({
          loading: false,
          source: "unavailable",
          error: err?.message || "Rates unavailable",
        })
      }
    }

    load()
  }, [userId, primary, symbolsKey])

  const refreshRates = useCallback(
    async (force = false) => {
      if (!userId) return
      const gen = ++fetchGen.current
      setRatesMeta((m) => ({ ...m, loading: true, error: null }))
      try {
        const symbolList = symbolsKey ? symbolsKey.split(",") : [primary]
        const result = await getRatesTable({
          userId,
          baseCurrency: primary,
          symbols: symbolList,
          forceRefresh: force,
        })
        if (gen !== fetchGen.current) return
        setRatesTable(result.table || null)
        const errMsg =
          result.error instanceof Error
            ? result.error.message
            : result.error
              ? String(result.error)
              : null
        setRatesMeta({
          loading: false,
          source: result.source,
          error: result.table ? null : errMsg,
        })
      } catch (err) {
        if (gen !== fetchGen.current) return
        setRatesMeta({
          loading: false,
          source: "unavailable",
          error: err?.message || "Rates unavailable",
        })
      }
    },
    [userId, primary, symbolsKey]
  )

  const formatPrimary = useCallback(
    (amount) => formatCurrency(amount, primary),
    [primary]
  )

  const value = useMemo(
    () => ({
      primary,
      secondaries,
      ratesTable,
      ratesMeta,
      refreshRates,
      formatPrimary,
      formatCurrency,
    }),
    [primary, secondaries, ratesTable, ratesMeta, refreshRates, formatPrimary]
  )

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    return {
      primary: "PHP",
      secondaries: [],
      ratesTable: null,
      ratesMeta: { loading: false },
      refreshRates: () => {},
      formatPrimary: (n) => formatCurrency(n, "PHP"),
      formatCurrency,
    }
  }
  return ctx
}
