import { hasActiveFilters } from "../utils/transactionFilters"

export function FilterTriggerButton({ active, open, onClick }) {
  return (
    <button
      type="button"
      className={`filter-trigger ${active ? "active" : ""} ${open ? "open" : ""}`}
      onClick={onClick}
      aria-expanded={open}
      aria-label="Filter transactions"
      title="Filters"
    >
      <svg
        className="filter-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <path d="M4 6h16M7 12h10M10 18h4" />
      </svg>
      {active && <span className="filter-active-dot" />}
    </button>
  )
}

export function FilterDropdown({ filters, onChange, onClear, onApply }) {
  const update = (key, value) => {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="filter-dropdown">
      <div className="filter-dropdown-header">
        <strong>Filters</strong>
        {hasActiveFilters(filters) && (
          <button type="button" className="link-btn" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      <div className="filter-dropdown-grid">
        <label className="filter-dropdown-field">
          <span>Date from</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
          />
        </label>
        <label className="filter-dropdown-field">
          <span>Date to</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
          />
        </label>
        <label className="filter-dropdown-field">
          <span>Amount min</span>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={filters.amountMin}
            onChange={(e) => update("amountMin", e.target.value)}
          />
        </label>
        <label className="filter-dropdown-field">
          <span>Amount max</span>
          <input
            type="number"
            min="0"
            placeholder="Any"
            value={filters.amountMax}
            onChange={(e) => update("amountMax", e.target.value)}
          />
        </label>
        <label className="filter-dropdown-field">
          <span>Type</span>
          <select
            value={filters.type}
            onChange={(e) => update("type", e.target.value)}
          >
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="payroll">Payroll</option>
            <option value="transfer">Transfer</option>
          </select>
        </label>
        <label className="filter-dropdown-field">
          <span>Category</span>
          <input
            type="text"
            placeholder="e.g. Food"
            value={filters.category}
            onChange={(e) => update("category", e.target.value)}
          />
        </label>
        <label className="filter-dropdown-field span-2">
          <span>Keyword search</span>
          <input
            type="text"
            placeholder="Search notes, accounts, amounts…"
            value={filters.keyword}
            onChange={(e) => update("keyword", e.target.value)}
          />
        </label>
      </div>

      <button type="button" className="btn-sm filter-apply-btn" onClick={onApply}>
        Apply filters
      </button>
    </div>
  )
}
