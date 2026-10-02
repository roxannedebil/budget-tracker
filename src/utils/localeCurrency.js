import { ISO4217_CURRENCIES } from "../data/iso4217"

const REGION_CURRENCY = {
  PH: "PHP",
  US: "USD",
  GB: "GBP",
  JP: "JPY",
  AU: "AUD",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  HK: "HKD",
  SG: "SGD",
  KR: "KRW",
  IN: "INR",
  MY: "MYR",
  TH: "THB",
  ID: "IDR",
  VN: "VND",
  AE: "AED",
  SA: "SAR",
  NZ: "NZD",
  MX: "MXN",
  BR: "BRL",
  ZA: "ZAR",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  TR: "TRY",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  IE: "EUR",
  AT: "EUR",
  BE: "EUR",
  PT: "EUR",
  FI: "EUR",
}

const KNOWN = new Set(ISO4217_CURRENCIES.map((c) => c.code))

/** Best-effort ISO code from browser locale for first-run primary currency. */
export function guessCurrencyFromLocale(fallback = "PHP") {
  if (typeof navigator === "undefined") return fallback

  const locale = navigator.language || "en-PH"
  try {
    const region = new Intl.Locale(locale).region
    if (region) {
      const code = REGION_CURRENCY[region.toUpperCase()]
      if (code && KNOWN.has(code)) return code
    }
  } catch {
    /* Intl.Locale unsupported */
  }

  const parts = locale.split(/[-_]/)
  const maybeRegion = parts[1]?.toUpperCase()
  if (maybeRegion && REGION_CURRENCY[maybeRegion] && KNOWN.has(REGION_CURRENCY[maybeRegion])) {
    return REGION_CURRENCY[maybeRegion]
  }

  return KNOWN.has(fallback) ? fallback : "PHP"
}
