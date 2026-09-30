export function getDayKey(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function dayKeyFromParts(year, monthIndex, day) {
  const m = String(monthIndex + 1).padStart(2, "0")
  const d = String(day).padStart(2, "0")
  return `${year}-${m}-${d}`
}

export function summarizeTransactionsByDay(transactions) {
  const map = {}

  for (const t of transactions) {
    const key = getDayKey(t.date)
    if (!key) continue

    if (!map[key]) {
      map[key] = {
        income: 0,
        expense: 0,
        transfer: 0,
        count: 0,
        items: [],
      }
    }

    const amount = Number(t.amount) || 0
    if (t.type === "income") map[key].income += amount
    else if (t.type === "expense") map[key].expense += amount
    else if (t.type === "transfer") map[key].transfer += amount

    map[key].count += 1
    map[key].items.push(t)
  }

  for (const key of Object.keys(map)) {
    map[key].items.sort(
      (a, b) =>
        (b.transaction_id ?? b.id ?? 0) - (a.transaction_id ?? a.id ?? 0)
    )
  }

  return map
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function buildCalendarGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const leadingPadding = first.getDay()
  const cells = []

  for (let i = 0; i < leadingPadding; i++) {
    cells.push({ kind: "padding" })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      kind: "day",
      day,
      key: dayKeyFromParts(year, monthIndex, day),
      date: new Date(year, monthIndex, day),
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ kind: "padding" })
  }

  const monthLabel = first.toLocaleString("default", {
    month: "long",
    year: "numeric",
  })

  return {
    year,
    monthIndex,
    monthLabel,
    weekdayLabels: WEEKDAY_LABELS,
    cells,
  }
}

export function formatDayHeading(dayKey) {
  if (!dayKey) return "Select a day"
  const [y, m, d] = dayKey.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function isSameDayKey(a, b) {
  return a && b && a === b
}

export function getTodayKey() {
  return getDayKey(new Date())
}
