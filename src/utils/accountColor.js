const HEX6 = /^#?[0-9A-Fa-f]{6}$/
const HEX_PARTIAL = /^#?[0-9A-Fa-f]{0,6}$/

export function isPartialHexInput(value) {
  if (value == null) return true
  const raw = String(value).trim()
  if (!raw) return true
  return HEX_PARTIAL.test(raw)
}

export function normalizeAccountColorHex(value) {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const withHash = raw.startsWith("#") ? raw : `#${raw}`
  if (!HEX6.test(withHash)) return null
  return withHash.toUpperCase()
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** Stable fallback when user has not picked a color. */
export function defaultAccountColor(seed) {
  const h = hashString(String(seed ?? "account")) % 360
  return `hsl(${h} 52% 46%)`
}

export function getAccountDisplayColor(account) {
  const custom = normalizeAccountColorHex(account?.color_hex)
  if (custom) return custom
  const seed = account?.account_id ?? account?.name ?? ""
  return defaultAccountColor(seed)
}

export function accountColorStyleVars(account) {
  const color = getAccountDisplayColor(account)
  return { "--account-color": color }
}
