const REMEMBER_KEY = "koinest_remember_me"

export function getRememberMePreference() {
  return localStorage.getItem(REMEMBER_KEY) !== "false"
}

export function setRememberMePreference(remember) {
  localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false")
}

function supabaseAuthKeyPrefix() {
  const url = import.meta.env.VITE_SUPABASE_URL || ""
  const ref = url.match(/https:\/\/([^.]+)/)?.[1]
  return ref ? `sb-${ref}-auth-token` : "sb-"
}

/** Clear Supabase session keys from both storages before a targeted login. */
export function clearSupabaseAuthStorage() {
  const prefix = supabaseAuthKeyPrefix()
  for (const store of [localStorage, sessionStorage]) {
    const keys = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key && key.startsWith(prefix)) keys.push(key)
    }
    keys.forEach((k) => store.removeItem(k))
  }
}

/** Delegates Supabase auth persistence to localStorage (remember) or sessionStorage. */
export const supabaseAuthStorage = {
  getItem(key) {
    const store = getRememberMePreference() ? localStorage : sessionStorage
    return store.getItem(key)
  },
  setItem(key, value) {
    const store = getRememberMePreference() ? localStorage : sessionStorage
    store.setItem(key, value)
  },
  removeItem(key) {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  },
}
