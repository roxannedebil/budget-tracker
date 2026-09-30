import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import {
  formatDisplayDate,
  getLocalTodayParts,
  getTodayDateInputValue,
  parseDateInputValue,
  resolveDatePickerView,
  toDateInputValue,
} from "../utils/formatDate"

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState(() => resolveDatePickerView(value))
  const containerRef = useRef(null)

  const { year: viewYear, month: viewMonth } = view
  const validSelectedDate = parseDateInputValue(value)

  const applyViewFromValue = () => {
    setView(resolveDatePickerView(value))
  }

  useEffect(() => {
    if (isOpen) return
    applyViewFromValue()
  }, [value, isOpen])

  const openPicker = () => {
    if (disabled) return
    if (!isOpen) {
      flushSync(() => {
        setView(resolveDatePickerView(value))
      })
      setIsOpen(true)
      return
    }
    setIsOpen(false)
  }

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

  const handlePrevMonth = (e) => {
    e.stopPropagation()
    setView((v) => {
      if (v.month === 0) return { year: v.year - 1, month: 11 }
      return { ...v, month: v.month - 1 }
    })
  }

  const handleNextMonth = (e) => {
    e.stopPropagation()
    setView((v) => {
      if (v.month === 11) return { year: v.year + 1, month: 0 }
      return { ...v, month: v.month + 1 }
    })
  }

  const handleSelectDay = (day) => {
    const selected = new Date(viewYear, viewMonth, day, 12, 0, 0)
    onChange(toDateInputValue(selected))
    setIsOpen(false)
  }

  const handleSelectToday = (e) => {
    e.stopPropagation()
    const parts = getLocalTodayParts()
    setView({ year: parts.year, month: parts.month })
    onChange(getTodayDateInputValue())
    setIsOpen(false)
  }

  const viewMonthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()

  const calendarDays = []
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    calendarDays.push({ day: prevMonthDays - i, currentMonth: false, isPrev: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push({ day: d, currentMonth: true })
  }
  const totalSlots = Math.ceil(calendarDays.length / 7) * 7
  const trailingCount = totalSlots - calendarDays.length
  for (let i = 1; i <= trailingCount; i++) {
    calendarDays.push({ day: i, currentMonth: false, isNext: true })
  }

  const today = getLocalTodayParts()
  const isTodayCell = (d, isCurrent) =>
    isCurrent &&
    d === today.day &&
    viewMonth === today.month &&
    viewYear === today.year

  const isSelectedCell = (d, isCurrent) =>
    isCurrent &&
    validSelectedDate &&
    d === validSelectedDate.getDate() &&
    viewMonth === validSelectedDate.getMonth() &&
    viewYear === validSelectedDate.getFullYear()

  const displayText = value ? formatDisplayDate(value) : placeholder

  return (
    <div className="custom-datepicker-container" ref={containerRef}>
      <div
        className={`custom-datepicker-input ${isOpen ? "focused" : ""} ${disabled ? "disabled" : ""}`}
        onClick={openPicker}
        tabIndex={disabled ? -1 : 0}
        role="button"
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault()
            openPicker()
          }
        }}
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
          <div className="datepicker-popover-header">
            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={handlePrevMonth}
              title="Previous month"
            >
              ‹
            </button>

            <span className="datepicker-month-title" aria-live="polite">
              {viewMonthLabel}
            </span>

            <button
              type="button"
              className="datepicker-nav-btn"
              onClick={handleNextMonth}
              title="Next month"
            >
              ›
            </button>
          </div>

          <div className="datepicker-weekdays">
            {DAY_NAMES.map((name) => (
              <span key={name} className="datepicker-weekday">
                {name}
              </span>
            ))}
          </div>

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
