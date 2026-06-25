import * as XLSX from "xlsx"

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
  if (value == null || value === "") return new Date().toISOString()

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d).toISOString()
    }
  }

  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString()
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
  const { amount, type, category, notes, date, from_account_id, to_account_id } =
    row

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
    notes,
    date,
    income_source: incomeSource,
    from_account_id: type === "expense" || type === "transfer" ? from_account_id : null,
    to_account_id: type === "income" || type === "transfer" ? to_account_id : null,
  }
}

export function parseTransactionRows(rows, accounts = []) {
  if (!rows.length) {
    return { rows: [], errors: ["The file is empty."] }
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
    }
  }

  const parsed = []
  const errors = []

  dataRows.forEach((row, index) => {
    const rowNum = index + 2
    const isEmpty = row.every((cell) => cell == null || String(cell).trim() === "")
    if (isEmpty) return

    const amountRaw = row[mapping.amount]
    const amount = Number(amountRaw)
    if (!amountRaw && amountRaw !== 0) {
      errors.push(`Row ${rowNum}: amount is required`)
      return
    }
    if (Number.isNaN(amount) || amount < 0) {
      errors.push(`Row ${rowNum}: amount must be a positive number`)
      return
    }

    const type = normalizeType(row[mapping.type])
    if (!type) {
      errors.push(`Row ${rowNum}: type must be income, expense, or transfer`)
      return
    }

    const fromName =
      mapping.from_account !== undefined ? row[mapping.from_account] : ""
    const toName =
      mapping.to_account !== undefined ? row[mapping.to_account] : ""
    const fromAccount = resolveAccount(accounts, fromName)
    const toAccount = resolveAccount(accounts, toName)

    if (type === "income" && !toAccount) {
      errors.push(`Row ${rowNum}: to_account is required for income`)
      return
    }
    if (type === "expense" && !fromAccount) {
      errors.push(`Row ${rowNum}: from_account is required for expense`)
      return
    }
    if (type === "transfer") {
      if (!fromAccount || !toAccount) {
        errors.push(`Row ${rowNum}: from_account and to_account required for transfer`)
        return
      }
      if (fromAccount.account_id === toAccount.account_id) {
        errors.push(`Row ${rowNum}: from and to accounts must differ`)
        return
      }
    }

    const category =
      mapping.category !== undefined
        ? String(row[mapping.category] ?? "").trim()
        : ""

    if (type === "expense" && !category) {
      errors.push(`Row ${rowNum}: category is required for expense`)
      return
    }

    const dateIndex = mapping.date
    const date =
      dateIndex !== undefined ? parseExcelDate(row[dateIndex]) : new Date().toISOString()
    if (date === null) {
      errors.push(`Row ${rowNum}: invalid date (use YYYY-MM-DD)`)
      return
    }

    const notesIndex = mapping.notes
    const notes =
      notesIndex !== undefined ? String(row[notesIndex] ?? "").trim() : ""

    parsed.push(
      buildRowPayload(
        {
          amount,
          type,
          category,
          notes,
          date,
          from_account_id: fromAccount?.account_id ?? null,
          to_account_id: toAccount?.account_id ?? null,
        },
        accounts
      )
    )
  })

  if (!parsed.length && !errors.length) {
    errors.push("No transaction rows found in the file.")
  }

  return { rows: parsed, errors }
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
    [30000, "income", "", accountHint, "", "2026-06-01", "Payroll"],
    [350, "expense", accountHint2, "", "Food", "2026-06-02", "Groceries"],
    [500, "transfer", accountHint, accountHint2, "", "2026-06-03", "To e-wallet"],
  ]

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...sample])
  sheet["!cols"] = [
    { wch: 10 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Transactions")
  XLSX.writeFile(workbook, "transaction-import-template.xlsx")
}
