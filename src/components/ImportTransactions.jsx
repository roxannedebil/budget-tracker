import { useRef, useState } from "react"
import { supabase } from "../supabaseClient"
import { persistCategorySelection } from "../utils/categories"
import {
  downloadImportTemplate,
  readTransactionsFromFile,
  TEMPLATE_COLUMNS,
} from "../utils/importTransactions"

function ImportTransactions({ accounts, onImport }) {
  const fileRef = useRef(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState("error")

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setMessage("")

    if (!accounts.length) {
      setMessageType("error")
      setMessage("Add at least one account before importing.")
      e.target.value = ""
      return
    }

    if (!file.name.endsWith(".xlsx")) {
      setMessageType("error")
      setMessage("Please upload an .xlsx file.")
      e.target.value = ""
      return
    }

    setImporting(true)

    try {
      const { rows, errors } = await readTransactionsFromFile(file, accounts)

      if (errors.length) {
        setMessageType("error")
        setMessage(errors.slice(0, 3).join(" "))
        if (errors.length > 3) {
          setMessage((m) => `${m} (+${errors.length - 3} more)`)
        }
        setImporting(false)
        e.target.value = ""
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      rows.forEach((row) => {
        if (row.type === "expense" && row.category) {
          persistCategorySelection("expense", row.category, row.subcategory)
        }
        if (row.type === "income" && row.category) {
          persistCategorySelection("income", row.category, row.subcategory)
        }
      })

      const payload = rows.map((row) => ({
        ...row,
        user_id: user?.id,
      }))

      const { error } = await supabase.from("transactions").insert(payload)

      if (error) {
        setMessageType("error")
        setMessage(error.message)
      } else {
        setMessageType("success")
        setMessage(`Imported ${rows.length} transaction(s).`)
        onImport()
      }
    } catch (err) {
      setMessageType("error")
      setMessage(err.message)
    }

    setImporting(false)
    e.target.value = ""
  }

  const requiredCols = TEMPLATE_COLUMNS.filter((c) => c.required)
    .map((c) => c.name)
    .join(", ")

  return (
    <details className="card collapsible import-card">
      <summary className="collapsible-summary">
        <h2>Import Excel</h2>
        <span className="chip muted-chip">.xlsx</span>
      </summary>

      <div className="collapsible-body">
        <p className="muted compact-hint">
          Required: <code>{requiredCols}</code>. Account names must match your
          accounts exactly.
        </p>

        <details className="nested-details">
          <summary>Column reference</summary>
          <ul className="column-list compact">
            {TEMPLATE_COLUMNS.map((col) => (
              <li key={col.name}>
                <code>{col.name}</code>
                <span className={col.required ? "required-tag" : "optional-tag"}>
                  {col.required ? "req" : "opt"}
                </span>
                <span className="col-desc">{col.description}</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="import-actions">
          <label htmlFor="xlsx-upload" className="upload-btn">
            {importing ? "Importing…" : "Choose file"}
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            onChange={handleFile}
            disabled={importing}
            id="xlsx-upload"
            hidden
          />
          <button
            type="button"
            className="btn-sm ghost"
            onClick={() =>
              downloadImportTemplate(accounts.map((a) => a.name))
            }
          >
            Template
          </button>
        </div>

        {message && (
          <p className={`inline-alert ${messageType}`}>{message}</p>
        )}
      </div>
    </details>
  )
}

export default ImportTransactions
