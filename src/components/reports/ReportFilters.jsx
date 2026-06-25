import {
  DATE_RANGE_PRESETS,
  formatFilterDateRange,
  getDefaultReportFilters,
} from "../../utils/reportFilters"

function ReportFilters({
  filters,
  onChange,
  categories,
  onExportExcel,
  onExportCsv,
  onExportTransactions,
}) {
  const update = (key, value) => onChange({ ...filters, [key]: value })

  const reset = () => onChange(getDefaultReportFilters())

  const applyPreset = (preset) => {
    const range = preset.getRange()
    onChange({ ...filters, ...range })
  }

  const activePreset = DATE_RANGE_PRESETS.find((p) => {
    const range = p.getRange()
    return (
      range.dateFrom === filters.dateFrom && range.dateTo === filters.dateTo
    )
  })

  const hasExtraFilters = filters.type || filters.category

  return (
    <div className="card report-filters-card module-card">
      <div className="report-filters-top">
        <div>
          <h2 className="report-filters-title">Filters & export</h2>
          <p className="report-range-display">
            {formatFilterDateRange(filters)}
          </p>
        </div>
        <button type="button" className="ghost-btn" onClick={reset}>
          Reset filters
        </button>
      </div>

      <div className="report-filter-section">
        <p className="report-filter-section-label">Quick range</p>
        <div className="date-preset-row">
          {DATE_RANGE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-chip ${activePreset?.id === preset.id ? "active" : ""}`}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="report-filter-section">
        <p className="report-filter-section-label">Custom range & filters</p>
        <div className="report-filters-grid">
          <label className="filter-field">
            <span>Start date</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => update("dateFrom", e.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>End date</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => update("dateTo", e.target.value)}
            />
          </label>
          <label className="filter-field">
            <span>Type</span>
            <select
              value={filters.type}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Category</span>
            <select
              value={filters.category}
              onChange={(e) => update("category", e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        {hasExtraFilters && (
          <div className="active-filter-tags">
            {filters.type && (
              <span className="filter-tag">
                Type: {filters.type}
                <button
                  type="button"
                  aria-label="Clear type"
                  onClick={() => update("type", "")}
                >
                  ×
                </button>
              </span>
            )}
            {filters.category && (
              <span className="filter-tag">
                {filters.category}
                <button
                  type="button"
                  aria-label="Clear category"
                  onClick={() => update("category", "")}
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="report-filter-section report-export-section">
        <p className="report-filter-section-label">Download</p>
        <div className="export-btn-group">
          <button type="button" className="export-btn" onClick={onExportExcel}>
            <span className="export-btn-icon">📊</span>
            <span className="export-btn-text">
              <strong>Excel report</strong>
              <small>Summary + charts data</small>
            </span>
          </button>
          <button type="button" className="export-btn" onClick={onExportCsv}>
            <span className="export-btn-icon">📄</span>
            <span className="export-btn-text">
              <strong>Summary CSV</strong>
              <small>Totals & categories</small>
            </span>
          </button>
          <button
            type="button"
            className="export-btn"
            onClick={onExportTransactions}
          >
            <span className="export-btn-icon">💳</span>
            <span className="export-btn-text">
              <strong>Transactions</strong>
              <small>Filtered rows only</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReportFilters
