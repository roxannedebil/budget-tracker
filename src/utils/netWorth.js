import { convertMajor } from "../services/rates/ratesService"
import { getAccountBalancesByCurrency } from "./accountStats"
import { minorToMajor } from "./currency"
import { netWorthInPrimaryDetailed } from "./fxTotals"

export function sumBalancesByCurrency(accounts, transactions) {
  const totals = {}

  for (const account of accounts) {
    const buckets = getAccountBalancesByCurrency(account.account_id, transactions)
    for (const [cur, minor] of Object.entries(buckets)) {
      totals[cur] = (totals[cur] || 0) + minorToMajor(minor, cur)
    }
  }

  return totals
}

export function netWorthInPrimary(totalsByCurrency, primary, ratesTable) {
  return netWorthInPrimaryDetailed(totalsByCurrency, primary, ratesTable).total
}

export function netWorthSecondaryLines(totalsByCurrency, primary, secondaries, ratesTable) {
  return secondaries
    .filter((c) => c && c !== primary)
    .map((code) => {
      let sum = 0
      for (const [cur, major] of Object.entries(totalsByCurrency)) {
        const inSecondary = convertMajor(major, cur, code, ratesTable)
        if (Number.isFinite(inSecondary)) sum += inSecondary
      }
      return { currency: code, total: sum }
    })
}
