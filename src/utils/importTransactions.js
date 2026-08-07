import * as XLSX from "xlsx"
import { toStoredDate } from "./formatDate"

export const TEMPLATE_COLUMNS = [
  { name: "amount", required: true, description: "Number (e.g. 1500)" },
  {
    name: "type",
    required: true,
    description: "income, expense, or transfer",
  },
  {
    name: "from_account",
    required: false,
    description: "Account name — required for expense & transfer",
  },
  {
    name: "to_account",
    required: false,
    description: "Account name — required for income & transfer",
  },
  {
    name: "category",
    required: false,
    description: "Required for expense (e.g. Food)",
  },
  {
    name: "subcategory",
    required: false,
    description: "Optional subcategory (e.g. Groceries)",
  },
  { name: "date", required: false, description: "YYYY-MM-DD" },
  { name: "notes", required: false, description: "Optional" },
]

const COLUMN_ALIASES = {
  amount: ["amount", "amt", "value"],
  type: ["type", "transaction type", "transaction_type"],
  from_account: ["from_account", "from account", "from", "spent from", "source"],
  to_account: [
    "to_account",
    "to account",
    "to",
    "deposit to",
    "add to",
    "destination",
  ],
  category: ["category", "cat"],
  subcategory: ["subcategory", "sub category", "sub_category", "subcat"],
  date: ["date", "transaction date", "transaction_date"],
  notes: ["notes", "note", "description", "memo"],
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
}

function mapHeaders(headers) {
  const mapping = {}

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header)
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized)) {
        mapping[field] = index
      }
    }
  })

  return mapping
}

function parseExcelDate(value) {
  if (value == null || value === "") return toStoredDate(new Date())

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      const dateString = `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
      return toStoredDate(dateString)
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim()
    if (normalized) {
      return toStoredDate(normalized)
    }
  }

  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) {
    return toStoredDate(d)
  }

  return null
}

function normalizeType(value) {
  const type = String(value ?? "").trim().toLowerCase()
  if (["income", "expense", "transfer"].includes(type)) return type
  return null
}

function resolveAccount(accounts, name) {
  if (!name || !String(name).trim()) return null
  const needle = String(name).trim().toLowerCase()
  return (
    accounts.find((a) => a.name.toLowerCase() === needle) ??
    accounts.find((a) => a.name.toLowerCase().includes(needle))
  )
}

function buildRowPayload(row, accounts) {
  const {
    amount,
    type,
    category,
    subcategory,
    notes,
    date,
    from_account_id,
    to_account_id,
  } = row

  const depositAccount =
    type === "income"
      ? accounts.find((a) => a.account_id === to_account_id)
      : null

  const incomeSource =
    type === "income" && depositAccount?.account_type === "bank"
      ? "payroll"
      : type === "income"
        ? "other"
        : null

  let resolvedCategory = category
  if (type === "transfer") {
    resolvedCategory = "Transfer"
  } else if (type === "income") {
    resolvedCategory =
      depositAccount?.account_type === "bank" ? "Payroll" : "Income"
  }

  return {
    amount,
    type,
    category: resolvedCategory,
    subcategory: type === "transfer" ? null : subcategory || null,
    notes,
    date,
    income_source: incomeSource,
    from_account_id: type === "expense" || type === "transfer" ? from_account_id : null,
    to_account_id: type === "income" || type === "transfer" ? to_account_id : null,
  }
}

export function parseTransactionRows(rows, accounts = []) {
  if (!rows.length) {
    return {
      rows: [],
      errors: ["The file is empty."],
      previewRows: [],
      stats: { totalRows: 0, validCount: 0, invalidCount: 0, totalIncome: 0, totalExpense: 0, totalTransfer: 0 },
    }
  }

  const [headerRow, ...dataRows] = rows
  const mapping = mapHeaders(headerRow)

  const missing = ["amount", "type"].filter((col) => mapping[col] === undefined)
  if (missing.length) {
    return {
      rows: [],
      errors: [
        `Missing required column(s): ${missing.join(", ")}. Required: amount, type.`,
      ],
      previewRows: [],
      stats: { totalRows: 0, validCount: 0, invalidCount: 0, totalIncome: 0, totalExpense: 0, totalTransfer: 0 },
    }
  }

  const validRows = []
  const summaryErrors = []
  const previewRows = []

  let totalIncome = 0
  let totalExpense = 0
  let totalTransfer = 0

  dataRows.forEach((row, index) => {
    const rowNum = index + 2
    const isEmpty = row.every((cell) => cell == null || String(cell).trim() === "")
    if (isEmpty) return

    const rowErrors = []

    const amountRaw = row[mapping.amount]
    const amount = Number(amountRaw)
    if (!amountRaw && amountRaw !== 0) {
      rowErrors.push("Amount is required")
    } else if (Number.isNaN(amount) || amount < 0) {
      rowErrors.push("Amount must be a positive number")
    }

    const rawType = row[mapping.type]
    const type = normalizeType(rawType)
    if (!type) {
      rowErrors.push(`Invalid type "${rawType ?? ""}" (must be income, expense, or transfer)`)
    }

    const fromName =
      mapping.from_account !== undefined ? String(row[mapping.from_account] ?? "").trim() : ""
    const toName =
      mapping.to_account !== undefined ? String(row[mapping.to_account] ?? "").trim() : ""
    const fromAccount = resolveAccount(accounts, fromName)
    const toAccount = resolveAccount(accounts, toName)

    if (type === "income") {
      if (!toName) {
        rowErrors.push("to_account is required for income")
      } else if (!toAccount) {
        rowErrors.push(`Account "${toName}" not found in your accounts`)
      }
    } else if (type === "expense") {
      if (!fromName) {
        rowErrors.push("from_account is required for expense")
      } else if (!fromAccount) {
        rowErrors.push(`Account "${fromName}" not found in your accounts`)
      }
    } else if (type === "transfer") {
      if (!fromName || !toName) {
        rowErrors.push("from_account and to_account are required for transfer")
      } else {
        if (!fromAccount) {
          rowErrors.push(`From account "${fromName}" not found`)
        }
        if (!toAccount) {
          rowErrors.push(`To account "${toName}" not found`)
        }
        if (fromAccount && toAccount && fromAccount.account_id === toAccount.account_id) {
          rowErrors.push("From and To accounts must be different")
        }
      }
    }

    const category =
      mapping.category !== undefined
        ? String(row[mapping.category] ?? "").trim()
        : ""

    const subcategory =
      mapping.subcategory !== undefined
        ? String(row[mapping.subcategory] ?? "").trim()
        : ""

    if (type === "expense" && !category) {
      rowErrors.push("Category is required for expense")
    }

    const dateIndex = mapping.date
    const rawDate = dateIndex !== undefined ? row[dateIndex] : null
    const date =
      rawDate != null && String(rawDate).trim() !== ""
        ? parseExcelDate(rawDate)
        : toStoredDate(new Date())

    if (date === null) {
      rowErrors.push("Invalid date format (use YYYY-MM-DD)")
    }

    const notesIndex = mapping.notes
    const notes =
      notesIndex !== undefined ? String(row[notesIndex] ?? "").trim() : ""

    const isValid = rowErrors.length === 0
    let payload = null

    if (isValid) {
      payload = buildRowPayload(
        {
          amount,
          type,
          category,
          subcategory,
          notes,
          date,
          from_account_id: fromAccount?.account_id ?? null,
          to_account_id: toAccount?.account_id ?? null,
        },
        accounts
      )
      validRows.push(payload)

      if (type === "income") totalIncome += amount
      else if (type === "expense") totalExpense += amount
      else if (type === "transfer") totalTransfer += amount
    } else {
      rowErrors.forEach((err) => {
        summaryErrors.push(`Row ${rowNum}: ${err}`)
      })
    }

    previewRows.push({
      rowNum,
      isValid,
      errors: rowErrors,
      raw: {
        amount: amountRaw,
        type: rawType,
        from_account: fromName,
        to_account: toName,
        category,
        subcategory,
        date: rawDate,
        notes,
      },
      parsed: {
        amount: isValid ? amount : amountRaw,
        type: type || rawType,
        fromAccountName: fromAccount?.name || fromName || "—",
        toAccountName: toAccount?.name || toName || "—",
        category: category || (type === "transfer" ? "Transfer" : "—"),
        subcategory: subcategory || "—",
        date: date || "—",
        notes: notes || "—",
        payload,
      },
    })
  })

  if (!previewRows.length && !summaryErrors.length) {
    summaryErrors.push("No transaction rows found in the file.")
  }

  return {
    rows: validRows,
    errors: summaryErrors,
    previewRows,
    stats: {
      totalRows: previewRows.length,
      validCount: validRows.length,
      invalidCount: previewRows.length - validRows.length,
      totalIncome,
      totalExpense,
      totalTransfer,
    },
  }
}

export function readTransactionsFromFile(file, accounts = []) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: "array", cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
        resolve(parseTransactionRows(rows, accounts))
      } catch {
        reject(new Error("Could not read file. Please upload a valid .xlsx file."))
      }
    }

    reader.onerror = () => reject(new Error("Failed to read file."))
    reader.readAsArrayBuffer(file)
  })
}

export function downloadImportTemplate(accountNames = []) {
  const headers = TEMPLATE_COLUMNS.map((c) => c.name)
  const accountHint = accountNames[0] ?? "BDO Payroll"
  const accountHint2 = accountNames[1] ?? "GCash"

  const sample = [
    [30000, "income", "", accountHint, "", "", "2026-06-01", "Payroll"],
    [350, "expense", accountHint2, "", "Food", "Groceries", "2026-06-02", "Groceries"],
    [500, "transfer", accountHint, accountHint2, "", "", "2026-06-03", "To e-wallet"],
  ]

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...sample])
  sheet["!cols"] = [
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 20 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Transactions")
  XLSX.writeFile(workbook, "transaction-import-template.xlsx")
}
