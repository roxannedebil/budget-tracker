import { useRef, useState } from "react"
import { supabase } from "../supabaseClient"
import { persistCategorySelection } from "../utils/categories"
import {
  downloadImportTemplate,
  readTransactionsFromFile,
  TEMPLATE_COLUMNS,
} from "../utils/importTransactions"
import { formatMoney } from "../utils/transactionStats"

function ImportTransactions({ accounts = [], onImport }) {
  const fileRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [parseResult, setParseResult] = useState(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [activeTab, setActiveTab] = useState("all") // 'all' | 'valid' | 'invalid'
  const [showColumnGuide, setShowColumnGuide] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("error") // 'error' | 'success' | 'warning'

  const resetState = () => {
    setSelectedFile(null)
    setParseResult(null)
    setMessage("")
    if (fileRef.current) fileRef.current.value = ""
  }

  const processFile = async (file) => {
    if (!file) return

    setMessage("")

    if (!accounts.length) {
      setMessageType("error")
      setMessage("Please add at least one account in Settings/Accounts before importing.")
      setIsOpen(true)
      return
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setMessageType("error")
      setMessage("Unsupported format. Please upload a standard Excel spreadsheet (.xlsx).")
      setIsOpen(true)
      return
    }

    setSelectedFile(file)
    setIsParsing(true)
    setIsOpen(true)

    try {
      const result = await readTransactionsFromFile(file, accounts)
      setParseResult(result)
      setActiveTab(result.stats.invalidCount > 0 ? "all" : "valid")

      if (result.stats.totalRows === 0) {
        setMessageType("error")
        setMessage("The selected file contains no readable transaction rows.")
      } else if (result.stats.invalidCount > 0) {
        setMessageType("warning")
        setMessage(
          `Found ${result.stats.invalidCount} issue(s) out of ${result.stats.totalRows} rows. Review below before importing.`
        )
      } else {
        setMessageType("success")
        setMessage(`File parsed successfully! ${result.stats.validCount} transaction(s) ready to import.`)
      }
    } catch (err) {
      setParseResult(null)
      setMessageType("error")
      setMessage(err.message || "Failed to process the Excel file.")
    } finally {
      setIsParsing(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleImportConfirm = async () => {
    if (!parseResult || !parseResult.rows.length) return

    setIsImporting(true)
    setMessage("")

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      // Persist newly discovered categories to category list
      parseResult.rows.forEach((row) => {
        if (row.type === "expense" && row.category) {
          persistCategorySelection("expense", row.category, row.subcategory)
        }
        if (row.type === "income" && row.category) {
          persistCategorySelection("income", row.category, row.subcategory)
        }
      })

      const payload = parseResult.rows.map((row) => ({
        ...row,
        user_id: user?.id,
      }))

      const { error } = await supabase.from("transactions").insert(payload)

      if (error) {
        setMessageType("error")
        setMessage(`Database import failed: ${error.message}`)
      } else {
        const importedCount = parseResult.rows.length
        setMessageType("success")
        setMessage(`🎉 Successfully imported ${importedCount} transaction(s)!`)
        resetState()
        onImport?.()
      }
    } catch (err) {
      setMessageType("error")
      setMessage(err.message || "An unexpected error occurred during import.")
    } finally {
      setIsImporting(false)
    }
  }

  const filteredPreviewRows = (parseResult?.previewRows || []).filter((row) => {
    if (activeTab === "valid") return row.isValid
    if (activeTab === "invalid") return !row.isValid
    return true
  })

  return (
    <div className={`excel-import-wrapper card ${isOpen ? "open" : ""}`}>
      {/* Header Bar */}
      <div
        className="excel-import-header"
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setIsOpen(!isOpen)}
      >
        <div className="excel-header-title">
          <div className="excel-icon-badge">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M8 13h8" />
              <path d="M8 17h8" />
              <path d="M10 9h1" />
            </svg>
          </div>
          <div>
            <div className="excel-title-row">
              <h2 className="excel-title">Import Excel</h2>
              <span className="excel-chip">.xlsx</span>
              {parseResult && (
                <span className={`status-badge-mini ${parseResult.stats.invalidCount > 0 ? "warning" : "success"}`}>
                  {parseResult.stats.validCount} valid
                </span>
              )}
            </div>
            <p className="excel-subtitle">
              Bulk import transactions from spreadsheet with automatic validation
            </p>
          </div>
        </div>

        <div className="excel-header-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="excel-btn-ghost"
            onClick={() => downloadImportTemplate(accounts.map((a) => a.name))}
            title="Download sample .xlsx template"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Template
          </button>
          <button
            type="button"
            className="excel-toggle-btn"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "Collapse Import section" : "Expand Import section"}
          >
            <svg
              className={`chevron-icon ${isOpen ? "rotated" : ""}`}
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isOpen && (
        <div className="excel-import-body">
          {/* Notification Message */}
          {message && (
            <div className={`excel-alert ${messageType}`}>
              <span className="alert-icon">
                {messageType === "success" && "✅"}
                {messageType === "error" && "⚠️"}
                {messageType === "warning" && "💡"}
              </span>
              <div className="alert-content">{message}</div>
              <button type="button" className="alert-close" onClick={() => setMessage("")}>
                ✕
              </button>
            </div>
          )}

          {/* Upload Dropzone (When no file is selected) */}
          {!selectedFile && (
            <div
              className={`excel-dropzone ${isDragging ? "dragging" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                id="xlsx-file-input"
                hidden
              />
              <div className="dropzone-content">
                <div className="dropzone-icon">
                  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                    <path d="M12 12v9" />
                    <path d="m16 16-4-4-4 4" />
                  </svg>
                </div>
                <div className="dropzone-text">
                  <h3>Drop your Excel file here</h3>
                  <p>
                    or <label htmlFor="xlsx-file-input" className="browse-link">browse files</label> on your device (.xlsx)
                  </p>
                </div>
                <div className="dropzone-footer">
                  <span className="hint-tag">Required headers: amount, type</span>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => setShowColumnGuide(!showColumnGuide)}
                  >
                    {showColumnGuide ? "Hide column guide" : "View column guide"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Column Reference Guide */}
          {showColumnGuide && (
            <div className="excel-column-guide">
              <div className="guide-header">
                <h4>Excel Column Format Reference</h4>
                <button
                  type="button"
                  className="guide-download-link"
                  onClick={() => downloadImportTemplate(accounts.map((a) => a.name))}
                >
                  Download sample file
                </button>
              </div>
              <div className="guide-grid">
                {TEMPLATE_COLUMNS.map((col) => (
                  <div key={col.name} className="guide-card">
                    <div className="guide-card-top">
                      <code className="guide-col-name">{col.name}</code>
                      <span className={`guide-tag ${col.required ? "required" : "optional"}`}>
                        {col.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    <p className="guide-col-desc">{col.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parsing Spinner */}
          {isParsing && (
            <div className="excel-loading-state">
              <div className="spinner"></div>
              <p>Analyzing and validating Excel transactions…</p>
            </div>
          )}

          {/* Parsed Staging Preview Section */}
          {selectedFile && parseResult && !isParsing && (
            <div className="excel-preview-section">
              {/* File Info Bar */}
              <div className="file-info-bar">
                <div className="file-info-left">
                  <div className="file-badge-icon">📊</div>
                  <div>
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                </div>
                <div className="file-info-actions">
                  <label htmlFor="xlsx-file-input" className="btn-sm ghost mini">
                    Change file
                  </label>
                  <button type="button" className="btn-sm ghost mini" onClick={resetState}>
                    Remove
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="preview-stats-grid">
                <div className="stat-pill">
                  <span className="stat-pill-label">Total Rows</span>
                  <span className="stat-pill-value">{parseResult.stats.totalRows}</span>
                </div>
                <div className="stat-pill success">
                  <span className="stat-pill-label">Valid to Import</span>
                  <span className="stat-pill-value">{parseResult.stats.validCount}</span>
                </div>
                <div className={`stat-pill ${parseResult.stats.invalidCount > 0 ? "danger" : "muted"}`}>
                  <span className="stat-pill-label">Validation Errors</span>
                  <span className="stat-pill-value">{parseResult.stats.invalidCount}</span>
                </div>
                <div className="stat-pill income">
                  <span className="stat-pill-label">Total Income</span>
                  <span className="stat-pill-value">{formatMoney(parseResult.stats.totalIncome)}</span>
                </div>
                <div className="stat-pill expense">
                  <span className="stat-pill-label">Total Expenses</span>
                  <span className="stat-pill-value">{formatMoney(parseResult.stats.totalExpense)}</span>
                </div>
              </div>

              {/* Row Filter Tabs */}
              <div className="preview-filter-tabs">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveTab("all")}
                >
                  All Rows ({parseResult.stats.totalRows})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === "valid" ? "active" : ""}`}
                  onClick={() => setActiveTab("valid")}
                >
                  Ready ({parseResult.stats.validCount})
                </button>
                {parseResult.stats.invalidCount > 0 && (
                  <button
                    type="button"
                    className={`tab-btn danger ${activeTab === "invalid" ? "active" : ""}`}
                    onClick={() => setActiveTab("invalid")}
                  >
                    Errors ({parseResult.stats.invalidCount})
                  </button>
                )}
              </div>

              {/* Preview Table */}
              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>From / To Account</th>
                      <th>Category</th>
                      <th>Date</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="empty-preview-cell">
                          No rows match the selected filter tab.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row) => (
                        <tr key={row.rowNum} className={row.isValid ? "row-valid" : "row-invalid"}>
                          <td className="cell-row-num">#{row.rowNum}</td>
                          <td>
                            {row.isValid ? (
                              <span className="status-chip success">Ready</span>
                            ) : (
                              <span className="status-chip danger" title={row.errors.join("; ")}>
                                Error
                              </span>
                            )}
                          </td>
                          <td>
                            <span className={`type-tag ${row.parsed.type}`}>
                              {row.parsed.type}
                            </span>
                          </td>
                          <td className="cell-amount">
                            {row.isValid ? formatMoney(row.parsed.amount) : String(row.raw.amount ?? "—")}
                          </td>
                          <td className="cell-accounts">
                            {row.parsed.type === "expense" && <span>From: {row.parsed.fromAccountName}</span>}
                            {row.parsed.type === "income" && <span>To: {row.parsed.toAccountName}</span>}
                            {row.parsed.type === "transfer" && (
                              <span>
                                {row.parsed.fromAccountName} ➔ {row.parsed.toAccountName}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="cat-cell">
                              <span className="cat-main">{row.parsed.category}</span>
                              {row.parsed.subcategory && row.parsed.subcategory !== "—" && (
                                <span className="cat-sub">({row.parsed.subcategory})</span>
                              )}
                            </div>
                          </td>
                          <td className="cell-date">{row.parsed.date}</td>
                          <td className="cell-notes" title={row.parsed.notes}>
                            {row.parsed.notes}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Validation Error List (if invalid rows exist) */}
              {parseResult.stats.invalidCount > 0 && (
                <div className="excel-error-details">
                  <h5>⚠️ Action Required for {parseResult.stats.invalidCount} Row(s):</h5>
                  <ul>
                    {parseResult.previewRows
                      .filter((r) => !r.isValid)
                      .map((r) => (
                        <li key={r.rowNum}>
                          <strong>Row {r.rowNum}:</strong> {r.errors.join(". ")}
                        </li>
                      ))}
                  </ul>
                  <p className="error-hint">
                    Valid rows will be imported, but you can also cancel, fix your Excel sheet, and re-upload.
                  </p>
                </div>
              )}

              {/* Action Bar */}
              <div className="excel-actions-bar">
                <button type="button" className="btn-sm ghost" onClick={resetState} disabled={isImporting}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-sm primary excel-submit-btn"
                  onClick={handleImportConfirm}
                  disabled={isImporting || parseResult.stats.validCount === 0}
                >
                  {isImporting ? (
                    <>
                      <span className="btn-spinner"></span> Importing…
                    </>
                  ) : (
                    `Import ${parseResult.stats.validCount} Transaction(s)`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ImportTransactions
