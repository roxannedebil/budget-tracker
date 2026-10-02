const KEY_PREFIX = "koinest_currency_setup_v1_"

export function hasCompletedCurrencySetup(userId) {
  if (!userId) return true
  return localStorage.getItem(`${KEY_PREFIX}${userId}`) === "1"
}

export function markCurrencySetupComplete(userId) {
  if (!userId) return
  localStorage.setItem(`${KEY_PREFIX}${userId}`, "1")
}

/** Lets the first-visit currency modal show again (same browser). */
export function resetCurrencySetup(userId) {
  if (!userId) return
  localStorage.removeItem(`${KEY_PREFIX}${userId}`)
}
