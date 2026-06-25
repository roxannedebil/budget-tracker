export function getDisplayName(profile, user) {
  const fromProfile = profile?.full_name?.trim()
  if (fromProfile) return fromProfile

  const fromMeta = user?.user_metadata?.full_name?.trim()
  if (fromMeta) return fromMeta

  const email = user?.email || profile?.email || ""
  if (email.includes("@")) return email.split("@")[0]

  return "User"
}

export function getAvatarUrl(profile, user) {
  return profile?.avatar_url || user?.user_metadata?.avatar_url || null
}

export function getInitials(name) {
  const trimmed = (name || "").trim()
  if (!trimmed) return "?"

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return parts[0].slice(0, 2).toUpperCase()
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]

export function validateAvatarFile(file) {
  if (!file) return "Choose an image file"
  if (!AVATAR_TYPES.includes(file.type)) {
    return "Use a JPG, PNG, WebP, or GIF image"
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return "Image must be 2 MB or smaller"
  }
  return null
}

export function formatProfileError(error) {
  const msg = error?.message || String(error || "")

  if (msg.includes("avatar_url") && msg.includes("schema cache")) {
    return "Database missing avatar_url column. In Supabase → SQL Editor, run supabase/add-avatar-url-column.sql, then try again."
  }

  if (msg.toLowerCase().includes("bucket not found")) {
    return "Avatar storage is not set up. In Supabase → SQL Editor, run supabase/add-profile-avatar.sql, then try again."
  }

  return msg || "Something went wrong."
}

export async function uploadAvatar(supabase, userId, file) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
  const filePath = `${userId}/avatar.${ext}`

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    throw uploadError
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath)

  return `${publicUrl}?t=${Date.now()}`
}
