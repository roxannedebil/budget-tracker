const APP_TIME_ZONE = "Asia/Manila"

const IMPORT_MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
]

const IMPORT_MONTH_FROM_ABBR = Object.fromEntries(
  IMPORT_MONTH_ABBR.map((m, i) => [m.toLowerCase(), i])
)

/** Spreadsheet template date, e.g. AUG-01-2026 (month is 1–12). */
export function formatImportSpreadsheetDateParts(year, month, day) {
  const monthIndex = Number(month) - 1
  if (monthIndex < 0 || monthIndex > 11) return ""
  return `${IMPORT_MONTH_ABBR[monthIndex]}-${String(day).padStart(2, "0")}-${year}`
}

/** Format a stored/import date value as MMM-DD-YYYY for display or Excel. */
export function formatImportSpreadsheetDate(value) {
  const date =
    value instanceof Date
      ? Number.isNaN(value.getTime())
        ? null
        : value
      : parseDateInputValue(value)
  if (!date) return "—"
  return `${IMPORT_MONTH_ABBR[date.getMonth()]}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`
}

function calendarDateFromParts({ year, month, day }) {
  return new Date(year, month, day, 12, 0, 0)
}

function toPhilippineMiddayISOString(date) {
  const philippineTime = new Date(date.toLocaleString("en-US", { timeZone: APP_TIME_ZONE }))
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

  const parsed = parseDateInputValue(raw)
  if (parsed) {
    return calendarDateFromParts({
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
      day: parsed.getDate(),
    }).toISOString()
  }

  return new Date().toISOString()
}

export function parseDateInputValue(value) {
  if (!value) return null

  const raw = String(value).trim()
  if (!raw) return null

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch
    return calendarDateFromParts({
      year: Number(year),
      month: Number(month) - 1,
      day: Number(day),
    })
  }

  const importMmmMatch = /^([A-Za-z]{3})-(\d{1,2})-(\d{4})$/.exec(raw)
  if (importMmmMatch) {
    const monthIndex = IMPORT_MONTH_FROM_ABBR[importMmmMatch[1].toLowerCase()]
    if (monthIndex !== undefined) {
      return calendarDateFromParts({
        year: Number(importMmmMatch[3]),
        month: monthIndex,
        day: Number(importMmmMatch[2]),
      })
    }
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  return calendarDateFromParts({
    year: parsed.getFullYear(),
    month: parsed.getMonth(),
    day: parsed.getDate(),
  })
}

export function toDateInputValue(value) {
  const date = parseDateInputValue(value)
  if (!date) return ""

  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function getTodayDateInputValue() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function formatDisplayDate(value) {
  if (!value) return "—"

  const date = parseDateInputValue(value)
  if (!date) return "—"

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function getLocalTodayParts() {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
  }
}

export function resolveDatePickerView(value) {
  const parsed = parseDateInputValue(value)

  if (parsed) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth(),
    }
  }

  const today = getLocalTodayParts()
  return {
    year: today.year,
    month: today.month,
  }
}
