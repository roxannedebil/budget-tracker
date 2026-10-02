import { supabase } from "../supabaseClient"
/** Display primary from settings row, with legacy profile fallback. */
export function getBaseCurrency(settings, profile) {
  const fromSettings = settings?.base_currency?.trim()
  if (fromSettings) return fromSettings.toUpperCase()
  return (profile?.primary_currency || "PHP").toUpperCase()
}

export function needsPrimaryCurrencySetup(settings) {
  if (!settings) return false
  return settings.primary_setup_completed !== true
}

export function userUsesConvertedTotals(accounts, transactions, primary) {
  const base = (primary || "PHP").toUpperCase()
  for (const a of accounts || []) {
    const def = (a.default_currency || "PHP").toUpperCase()
    if (def !== base) return true
    if (a.allow_multiple_currencies) return true
  }
  if (transactions?.length) {
    const seen = new Set()
    for (const t of transactions) {
      const cur = (t.currency || "PHP").toUpperCase()
      seen.add(cur)
      if (seen.size > 1) return true
      if (cur !== base) return true
    }
  }
  return false
}

export async function fetchUserSettings(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from("settings")
    .select("user_id, base_currency, primary_setup_completed, updated_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("Settings fetch error:", error.message)
    return null
  }
  return data
}

export async function saveBaseCurrency(userId, code, { markSetupComplete = false } = {}) {
  const base_currency = (code || "PHP").toUpperCase()
  const payload = {
    user_id: userId,
    base_currency,
    updated_at: new Date().toISOString(),
  }
  if (markSetupComplete) payload.primary_setup_completed = true

  const { data, error } = await supabase
    .from("settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("user_id, base_currency, primary_setup_completed, updated_at")
    .maybeSingle()

  return { data, error }
}
