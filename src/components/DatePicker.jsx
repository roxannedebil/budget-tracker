import { useEffect, useMemo, useRef, useState } from "react"
import { formatDisplayDate, toDateInputValue } from "../utils/formatDate"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
]
const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function DatePicker({ value, onChange, placeholder = "Select date", disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Parse initial selected date or default to today
  const parsedDate = value ? new Date(value) : null
  const validSelectedDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null

  // Calendar view year and month
  const initialViewDate = validSelectedDate || new Date()
  const [viewYear, setViewYear] = useState(initialViewDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialViewDate.getMonth())

  // Dynamic list of years (12 years past to 12 years future)
  const yearOptions = useMemo(() => {
    const currentY = new Date().getFullYear()
    const years = []
    for (let y = currentY - 12; y <= currentY + 12; y++) {
      years.push(y)
    }
    if (!years.includes(viewYear)) {
      years.push(viewYear)
      years.sort((a, b) => a - b)
    }
    return years
  }, [viewYear])

  // Keep view year/month updated when value changes from outside
  useEffect(() => {
    if (validSelectedDate) {
      setViewYear(validSelectedDate.getFullYear())
      setViewMonth(validSelectedDate.getMonth())
    }
  }, [value])

  // Close calendar on click outside safely without glitching on native selects
  useEffect(() => {
    function handleClickOutside(e) {
      if (!isOpen) return
      if (
        containerRef.current &&
        (containerRef.current.contains(e.target) ||
          (e.target.closest && e.target.closest(".custom-datepicker-container")))
      ) {
        return
      }
      setIsOpen(false)
    }

    document.addEventListener("click", handleClickOutside, true)
    return () => {
      document.removeEventListener("click", handleClickOutside, true)
    }
  }, [isOpen])

  // Navigate months
  const handlePrevMonth = (e) => {
    e.stopPropagation()
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = (e) => {
    e.stopPropagation()
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelectDay = (day) => {
    const selected = new Date(viewYear, viewMonth, day)
    const formatted = toDateInputValue(selected)
    onChange(formatted)
    setIsOpen(false)
  }

  const handleSelectToday = (e) => {
    e.stopPropagation()
    const today = new Date()
    setViewYear(today.getFullYear())
    setViewMonth(today.getMonth())
    onChange(toDateInputValue(today))
    setIsOpen(false)
  }

  // Calculate days in month grid
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()

  const calendarDays = []
  // Fill leading days from previous month
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, currentMonth: false, isPrev: true })
  }
  // Fill current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, currentMonth: true })
  }
  // Fill trailing days for next month
  const totalSlots = Math.ceil(calendarDays.length / 7) * 7
  const trailingCount = totalSlots - calendarDays.length
  for (let i = 1; i <= trailingCount; i++) {
    calendarDays.push({ day: i, currentMonth: false, isNext: true })
  }

  const today = new Date()
  const isTodayCell = (d, isCurrent) =>
    isCurrent &&
    d === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear()

  const isSelectedCell = (d, isCurrent) =>
    isCurrent &&
    validSelectedDate &&
    d === validSelectedDate.getDate() &&
    viewMonth === validSelectedDate.getMonth() &&
    viewYear === validSelectedDate.getFullYear()

  // Display text formatted as "MMM DD, YYYY" (e.g. Aug 7, 2026)
  const displayText = value ? formatDisplayDate(value) : placeholder

  return (
    <div className="custom-datepicker-container" ref={containerRef}>
      <div
        className={`custom-datepicker-input ${isOpen ? "focused" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        role="button"
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !disabled && setIsOpen(!isOpen)}
      >
        <span className={`datepicker-value ${!value ? "placeholder" : ""}`}>{displayText}</span>
        <svg
          className="datepicker-svg-icon"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {isOpen && (
        <div
          className="custom-datepicker-popover"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header Controls with Quick Month & Year Dropdowns */}
          <div className="datepicker-popover-header">
            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={handlePrevMonth}
              title="Previous month"
            >
              ‹
            </button>

            <div className="datepicker-select-group">
              <select
                className="datepicker-month-select"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                className="datepicker-year-select"
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={handleNextMonth}
              title="Next month"
            >
              ›
            </button>
          </div>

          {/* Weekday Names */}
          <div className="datepicker-weekdays">
            {DAY_NAMES.map((name) => (
              <span key={name} className="datepicker-weekday">
                {name}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="datepicker-days-grid">
            {calendarDays.map((item, index) => {
              const selected = isSelectedCell(item.day, item.currentMonth)
              const currentToday = isTodayCell(item.day, item.currentMonth)

              return (
                <button
                  key={index}
                  type="button"
                  disabled={!item.currentMonth}
                  className={`datepicker-day-btn ${!item.currentMonth ? "outside-month" : ""} ${
                    selected ? "selected" : ""
                  } ${currentToday ? "today" : ""}`}
                  onClick={() => item.currentMonth && handleSelectDay(item.day)}
                >
                  {item.day}
                </button>
              )
            })}
          </div>

          {/* Footer Bar */}
          <div className="datepicker-popover-footer">
            <button type="button" className="datepicker-today-btn" onClick={handleSelectToday}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
