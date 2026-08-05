function toPhilippineMiddayISOString(date) {
  const philippineTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Manila" }))
  return new Date(
    philippineTime.getFullYear(),
    philippineTime.getMonth(),
    philippineTime.getDate(),
    12,
    0,
    0
  ).toISOString()
}

export function toStoredDate(value) {
  if (!value) return new Date().toISOString()

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? new Date().toISOString()
      : toPhilippineMiddayISOString(value)
  }

  const raw = String(value).trim()
  if (!raw) return new Date().toISOString()

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0).toISOString()
  }

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return toPhilippineMiddayISOString(parsed)
  }

  return new Date().toISOString()
}

export function toDateInputValue(value) {
  if (!value) return ""

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function formatDisplayDate(value) {
  if (!value) return "—"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}
