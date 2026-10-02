export const FEE_PLAN_PREFIX = "bt-fee:v1:"

export function buildFeePlanPayload({
  feeMajor,
  feeCurrency,
  chargedTo,
  netReceiveMajor,
  grossReceiveMajor,
}) {
  if (feeMajor == null || Number(feeMajor) <= 0) return null
  return {
    feeMajor: Number(feeMajor),
    feeCurrency: (feeCurrency || "PHP").toUpperCase(),
    chargedTo: chargedTo === "to" ? "to" : "from",
    netReceiveMajor:
      netReceiveMajor != null && Number.isFinite(Number(netReceiveMajor))
        ? Number(netReceiveMajor)
        : null,
    grossReceiveMajor:
      grossReceiveMajor != null && Number.isFinite(Number(grossReceiveMajor))
        ? Number(grossReceiveMajor)
        : null,
  }
}

export function encodeFeePlanSubcategory(userSubcategory, plan) {
  if (!plan) return userSubcategory || null
  if (userSubcategory?.startsWith(FEE_PLAN_PREFIX)) {
    return FEE_PLAN_PREFIX + JSON.stringify(plan)
  }
  if (userSubcategory?.trim()) {
    return userSubcategory
  }
  return FEE_PLAN_PREFIX + JSON.stringify(plan)
}

export function parseFeePlanFromSubcategory(subcategory) {
  if (!subcategory?.startsWith(FEE_PLAN_PREFIX)) return null
  try {
    const raw = JSON.parse(subcategory.slice(FEE_PLAN_PREFIX.length))
    if (!raw?.feeMajor || Number(raw.feeMajor) <= 0) return null
    return raw
  } catch {
    return null
  }
}

export function feePlanToPersistedFee(plan, transferOut) {
  if (!plan) return null
  const chargedTo = plan.chargedTo === "to" ? "to" : "from"
  return {
    major: Number(plan.feeMajor),
    currency: (plan.feeCurrency || "PHP").toUpperCase(),
    chargedTo,
    netReceiveMajor: plan.netReceiveMajor,
    grossReceiveMajor: plan.grossReceiveMajor,
    source: "plan",
  }
}
