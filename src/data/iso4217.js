/** Static ISO 4217 codes for UI (no currency API). */
export const ISO4217_CURRENCIES = [
  { code: "PHP", name: "Philippine peso", decimals: 2 },
  { code: "USD", name: "US dollar", decimals: 2 },
  { code: "EUR", name: "Euro", decimals: 2 },
  { code: "GBP", name: "British pound", decimals: 2 },
  { code: "JPY", name: "Japanese yen", decimals: 0 },
  { code: "AUD", name: "Australian dollar", decimals: 2 },
  { code: "CAD", name: "Canadian dollar", decimals: 2 },
  { code: "CHF", name: "Swiss franc", decimals: 2 },
  { code: "CNY", name: "Chinese yuan", decimals: 2 },
  { code: "HKD", name: "Hong Kong dollar", decimals: 2 },
  { code: "SGD", name: "Singapore dollar", decimals: 2 },
  { code: "KRW", name: "South Korean won", decimals: 0 },
  { code: "INR", name: "Indian rupee", decimals: 2 },
  { code: "MYR", name: "Malaysian ringgit", decimals: 2 },
  { code: "THB", name: "Thai baht", decimals: 2 },
  { code: "IDR", name: "Indonesian rupiah", decimals: 0 },
  { code: "VND", name: "Vietnamese dong", decimals: 0 },
  { code: "AED", name: "UAE dirham", decimals: 2 },
  { code: "SAR", name: "Saudi riyal", decimals: 2 },
  { code: "NZD", name: "New Zealand dollar", decimals: 2 },
  { code: "MXN", name: "Mexican peso", decimals: 2 },
  { code: "BRL", name: "Brazilian real", decimals: 2 },
  { code: "ZAR", name: "South African rand", decimals: 2 },
  { code: "SEK", name: "Swedish krona", decimals: 2 },
  { code: "NOK", name: "Norwegian krone", decimals: 2 },
  { code: "DKK", name: "Danish krone", decimals: 2 },
  { code: "PLN", name: "Polish zloty", decimals: 2 },
  { code: "TRY", name: "Turkish lira", decimals: 2 },
]

export function getCurrencyMeta(code) {
  const upper = (code || "PHP").toUpperCase()
  return (
    ISO4217_CURRENCIES.find((c) => c.code === upper) ?? {
      code: upper,
      name: upper,
      decimals: 2,
    }
  )
}
