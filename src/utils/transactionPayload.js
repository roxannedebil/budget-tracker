import { convertMajor } from "../services/rates/ratesService"
import { signedMinorForType } from "./currency"

export function resolveRateToBase(currency, primary, ratesTable) {
  const cur = (currency || primary).toUpperCase()
  const base = (primary || "PHP").toUpperCase()
  if (cur === base) return 1
  if (!ratesTable) return null
  return convertMajor(1, cur, base, ratesTable)
}

export function buildIncomeExpensePayload({
  type,
  amountMajor,
  currency,
  primary,
  ratesTable,
  fields,
}) {
  const cur = (currency || primary).toUpperCase()
  const rate = resolveRateToBase(cur, primary, ratesTable)

  return {
    ...fields,
    type,
    amount: Number(amountMajor),
    amount_minor: signedMinorForType(type, amountMajor, cur),
    currency: cur,
    rate_to_base: rate,
    status: fields.status || "completed",
  }
}
