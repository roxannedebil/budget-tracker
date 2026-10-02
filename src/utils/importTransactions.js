import * as XLSX from "xlsx"
import {
  accountDefaultCurrency,
  getAccountCurrencyOptions,
} from "./accountCurrencies.js"
import {
  formatImportSpreadsheetDate,
  formatImportSpreadsheetDateParts,
  parseDateInputValue,
  toStoredDate,
} from "./formatDate"
import { resolveIncomeSource } from "./incomeSource"
import { summarizeByCurrency } from "./monthByCurrency"
import { buildIncomeExpensePayload, resolveRateToBase } from "./transactionPayload.js"
import {
  buildTransferFeeRowForTransfer,
  defaultFeeCurrencyForSide,
  FEE_CHARGE_FROM,
  FEE_CHARGE_TO,
  resolveFeeAccountId,
} from "./transferFee.js"
import { receivePerSendUnit } from "./transferFx.js"
import { validateImportBalances } from "./importBalanceCheck.js"
import {
  buildSimpleTransferRow,
  buildTransferHeader,
  buildTransferRows,
  parseOptionalFeeMajor,
  shouldUseSplitTransfer,
} from "./transferInsert.js"

export const TEMPLATE_COLUMNS = [
  {
    name: "date",
    required: false,
    description:
      "MMM-DD-YYYY (e.g. AUG-01-2026 or sep-01-2026; month letters are case-insensitive). Blank = today. YYYY-MM-DD also accepted.",
  },
  {
    name: "type",
    required: true,
    description: "Exactly one of: income, expense, transfer (lowercase).",
  },
  {
    name: "from_account",
    required: false,
    description: "Account name. Required for expense and transfer.",
  },
  {
    name: "amount",
    required: true,
    description:
      "Positive number. For transfer: amount sent from the From account (in currency column, or From account default).",
  },
  {
    name: "currency",
    required: false,
    description:
      "Send / expense / income currency (ISO code). Transfer send currency; defaults from From account.",
  },
  {
    name: "to_account",
    required: false,
    description: "Account name. Required for income and transfer.",
  },
  {
    name: "receive_amount",
    required: false,
    description:
      "Transfer only: amount that arrived in the To account. Required when send and receive currencies differ; leave blank for same-currency (uses amount).",
  },
  {
    name: "receive_currency",
    required: false,
    description:
      "Transfer only: currency of receive_amount. Defaults to the To account’s default currency.",
  },
  {
    name: "fee_charged_to",
    required: false,
    description:
      "Transfer only: account name that pays the fee (must match from_account or to_account). Required when fee_amount is set. Fee currency is inferred: send currency if that account is From, receive currency if To.",
  },
  {
    name: "fee_amount",
    required: false,
    description:
      "Transfer only: optional fee (positive number). Leave blank if no fee. No separate fee_currency column needed in the template.",
  },
  {
    name: "category",
    required: false,
    description:
      "Required for expense. Optional for income. Leave blank for transfer (Transfer out / Transfer in).",
  },
  {
    name: "subcategory",
    required: false,
    description: "Optional detail under category.",
  },
  {
    name: "notes",
    required: false,
    description: "Optional memo.",
  },
]

/** Not in the download template; importers may add this column manually for edge cases. */
export const IMPORT_ADVANCED_COLUMNS = [
  {
    name: "fee_currency",
    description:
      "Optional extra column (not in the template). Use only when the fee was deducted in a different currency than send (From) or receive (To) for fee_charged_to. Otherwise omit it.",
  },
]

export const IMPORT_GUIDE_TIPS = [
  "Use the column order in the template: date first, then type, accounts, amounts, fees, category, notes.",
  "Dates: MMM-DD-YYYY (e.g. AUG-01-2026 or Sep-01-2026; any letter case for the month).",
  "Account names must match your Accounts list (same spelling).",
  "One row = one income, one expense, or one completed transfer (creates out + in legs, and a fee leg if provided).",
  "Cross-currency: set currency (send), receive_amount, and receive_currency (or rely on To account default).",
  "Fees: fee_charged_to (paying account name) + fee_amount. Currency follows that account (send or receive side)—no fee_currency column in the template.",
  "Pending transfers are not imported—only completed history.",
  "Balances are checked in date order: each row uses only activity on or before that row's date (ledger + earlier import lines).",
  "Delete sample rows before importing your own data.",
]

const COLUMN_ALIASES = {
  amount: ["amount", "amt", "value", "send amount", "send_amount"],
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
  currency: ["currency", "curr", "iso currency", "iso_currency", "send currency", "send_currency"],
  receive_amount: [
    "receive_amount",
    "receive amount",
    "received",
    "amount received",
    "amount_received",
  ],
  receive_currency: [
    "receive_currency",
    "receive currency",
    "to currency",
    "to_currency",
  ],
  fee_amount: ["fee_amount", "fee amount", "fee", "transfer fee"],
  fee_currency: ["fee_currency", "fee currency"],
  fee_charged_to: [
    "fee_charged_to",
    "fee charged to",
    "fee_charged",
    "fee account",
    "charged to",
  ],
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

function cell(row, mapping, field) {
  if (mapping[field] === undefined) return undefined
  return row[mapping[field]]
}

function parseExcelDate(value) {
  if (value == null || value === "") return toStoredDate(new Date())

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : toStoredDate(value)
  }

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
      const parsed = parseDateInputValue(normalized)
      return parsed ? toStoredDate(parsed) : null
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

/** Map fee_charged_to cell to from/to side; prefer account names over legacy from/to keywords. */
function resolveFeeChargedTo(raw, fromAccount, toAccount) {
  const text = String(raw ?? "").trim()
  if (!text) return { side: null, accountName: null }

  const lower = text.toLowerCase()
  if (fromAccount && fromAccount.name.toLowerCase() === lower) {
    return { side: FEE_CHARGE_FROM, accountName: fromAccount.name }
  }
  if (toAccount && toAccount.name.toLowerCase() === lower) {
    return { side: FEE_CHARGE_TO, accountName: toAccount.name }
  }

  const partialMatches = []
  if (fromAccount && fromAccount.name.toLowerCase().includes(lower)) {
    partialMatches.push({ side: FEE_CHARGE_FROM, account: fromAccount })
  }
  if (toAccount && toAccount.name.toLowerCase().includes(lower)) {
    partialMatches.push({ side: FEE_CHARGE_TO, account: toAccount })
  }
  if (partialMatches.length === 1) {
    return {
      side: partialMatches[0].side,
      accountName: partialMatches[0].account.name,
    }
  }
  if (partialMatches.length > 1) {
    return { side: null, accountName: null, ambiguous: true }
  }

  // Legacy aliases (discouraged in docs; account names are clearer)
  if (lower === "from" || lower === "sender" || lower === "source") {
    return { side: FEE_CHARGE_FROM, accountName: fromAccount?.name ?? null }
  }
  if (lower === "to" || lower === "receiver" || lower === "destination") {
    return { side: FEE_CHARGE_TO, accountName: toAccount?.name ?? null }
  }

  return { side: null, accountName: null }
}

function resolveRowCurrency({ type, currencyRaw, fromAccount, toAccount, primary }) {
  const explicit = String(currencyRaw ?? "")
    .trim()
    .toUpperCase()
  if (explicit) return explicit
  if (type === "income" && toAccount) {
    return accountDefaultCurrency(toAccount, primary)
  }
  if ((type === "expense" || type === "transfer") && fromAccount) {
    return accountDefaultCurrency(fromAccount, primary)
  }
  return (primary || "PHP").toUpperCase()
}

function resolveReceiveCurrency({ receiveCurrencyRaw, toAccount, primary }) {
  const explicit = String(receiveCurrencyRaw ?? "")
    .trim()
    .toUpperCase()
  if (explicit) return explicit
  if (toAccount) return accountDefaultCurrency(toAccount, primary)
  return (primary || "PHP").toUpperCase()
}

function buildLogicalRow(row) {
  const {
    amount,
    type,
    category,
    subcategory,
    notes,
    date,
    currency,
    receiveMajor,
    receiveCurrency,
    feeMajor,
    feeCurrency,
    feeChargedTo,
    feeChargedToAccountName,
    from_account_id,
    to_account_id,
    fromAccount,
    toAccount,
  } = row

  let resolvedCategory = (category || "").trim()
  if (type === "transfer") {
    resolvedCategory = "Transfer out / Transfer in"
  } else if (type === "income" && !resolvedCategory) {
    resolvedCategory = "Uncategorized"
  }

  const incomeSource =
    type === "income" ? resolveIncomeSource(type, resolvedCategory) : null

  const sendCur = currency
  const recvCur = receiveCurrency
  const isCrossCurrency =
    type === "transfer" && sendCur && recvCur && sendCur !== recvCur

  return {
    amount,
    type,
    currency: sendCur,
    receiveMajor,
    receiveCurrency: recvCur,
    isCrossCurrency,
    feeMajor,
    feeCurrency,
    feeChargedTo,
    feeChargedToAccountName,
    category: resolvedCategory,
    subcategory: type === "transfer" ? null : subcategory || null,
    notes,
    date,
    income_source: incomeSource,
    from_account_id: type === "expense" || type === "transfer" ? from_account_id : null,
    to_account_id: type === "income" || type === "transfer" ? to_account_id : null,
    fromAccount,
    toAccount,
  }
}

function appendImportTransferFeeLeg(row, legs, transferId, ctx) {
  if (row.feeMajor == null || !row.feeChargedTo) return legs
  const feeAccountId = resolveFeeAccountId(
    row.feeChargedTo,
    row.from_account_id,
    row.to_account_id
  )
  return [
    ...legs,
    buildTransferFeeRowForTransfer({
      userId: ctx.userId,
      transferId,
      feeMajor: row.feeMajor,
      feeCurrency: row.feeCurrency,
      feeAccountId,
      date: row.date,
      notes: row.notes,
      rateToBase: resolveRateToBase(row.feeCurrency, ctx.primary, ctx.ratesTable),
      status: "completed",
    }),
  ]
}

/** Build insert plan: plain rows + transfer bundles (header + legs for FK-safe import). */
export function planImportInsert(logicalRows, { userId, primary, ratesTable }) {
  const transactions = []
  const transferBundles = []

  for (const row of logicalRows) {
    if (row.type === "income" || row.type === "expense") {
      transactions.push(
        buildIncomeExpensePayload({
          type: row.type,
          amountMajor: row.amount,
          currency: row.currency,
          primary,
          ratesTable,
          fields: {
            user_id: userId,
            category: row.category,
            subcategory: row.subcategory,
            notes: row.notes,
            date: row.date,
            income_source: row.income_source,
            from_account_id: row.from_account_id,
            to_account_id: row.to_account_id,
            status: "completed",
          },
        })
      )
      continue
    }

    if (row.type !== "transfer") continue

    const sendCur = row.currency
    const recvCur = row.receiveCurrency
    const sendMajor = Number(row.amount)
    const recvMajor = Number(row.receiveMajor)
    const hasFee = row.feeMajor != null && row.feeChargedTo
    const split = shouldUseSplitTransfer({
      sendCurrency: sendCur,
      receiveCurrency: recvCur,
      status: "completed",
    })
    const ctx = { userId, primary, ratesTable }

    if (!split && !hasFee) {
      transactions.push(
        buildSimpleTransferRow({
          userId,
          amountMajor: sendMajor,
          currency: sendCur,
          fromAccountId: row.from_account_id,
          toAccountId: row.to_account_id,
          notes: row.notes,
          date: row.date,
          rateToBase: resolveRateToBase(sendCur, primary, ratesTable),
        })
      )
      continue
    }

    const transferId = crypto.randomUUID()
    const header = buildTransferHeader({
      transferId,
      userId,
      status: "completed",
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
      sendCurrency: sendCur,
      receiveCurrency: recvCur,
      date: row.date,
      notes: row.notes,
    })

    let legs
    if (split) {
      const effectiveRate = row.isCrossCurrency
        ? receivePerSendUnit(sendMajor, recvMajor)
        : 1
      legs = buildTransferRows({
        userId,
        transferId,
        sendMajor,
        receiveMajor: recvMajor,
        sendCurrency: sendCur,
        receiveCurrency: recvCur,
        fromAccountId: row.from_account_id,
        toAccountId: row.to_account_id,
        notes: row.notes,
        date: row.date,
        status: "completed",
        marketRateEstimate: row.isCrossCurrency ? recvMajor : null,
        effectiveRate,
        rateToBaseSend: resolveRateToBase(sendCur, primary, ratesTable),
        rateToBaseReceive: resolveRateToBase(recvCur, primary, ratesTable),
      })
    } else {
      legs = [
        buildSimpleTransferRow({
          userId,
          amountMajor: sendMajor,
          currency: sendCur,
          fromAccountId: row.from_account_id,
          toAccountId: row.to_account_id,
          notes: row.notes,
          date: row.date,
          rateToBase: resolveRateToBase(sendCur, primary, ratesTable),
          transferId,
        }),
      ]
    }

    legs = appendImportTransferFeeLeg(row, legs, transferId, ctx)
    transferBundles.push({ header, transactions: legs })
  }

  return { transactions, transferBundles }
}

/** @deprecated Prefer planImportInsert + createTransferBundle for transfers */
export function expandImportRowsForInsert(logicalRows, ctx) {
  const plan = planImportInsert(logicalRows, ctx)
  return [
    ...plan.transactions,
    ...plan.transferBundles.flatMap((b) => b.transactions),
  ]
}

function applyBalanceFindings(validRows, previewRows, summaryErrors, findings) {
  if (!findings.length) {
    return { validRows, previewRows, summaryErrors }
  }

  const blocked = new Set(findings.map((f) => f.rowNum))
  const nextValid = validRows.filter((r) => !blocked.has(r.importRowNum))

  const previewByRow = new Map(previewRows.map((p) => [p.rowNum, p]))
  for (const finding of findings) {
    for (const err of finding.errors) {
      summaryErrors.push(`Row ${finding.rowNum}: ${err}`)
    }
    const preview = previewByRow.get(finding.rowNum)
    if (preview) {
      preview.isValid = false
      preview.errors = [...(preview.errors || []), ...finding.errors]
    }
  }

  return {
    validRows: nextValid,
    previewRows,
    summaryErrors,
  }
}

export function parseTransactionRows(
  rows,
  accounts = [],
  primary = "PHP",
  existingTransactions = []
) {
  if (!rows.length) {
    return {
      rows: [],
      errors: ["The file is empty."],
      previewRows: [],
      stats: {
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        totalIncome: 0,
        totalExpense: 0,
        totalTransfer: 0,
        byCurrency: [],
      },
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
      stats: {
        totalRows: 0,
        validCount: 0,
        invalidCount: 0,
        totalIncome: 0,
        totalExpense: 0,
        totalTransfer: 0,
        byCurrency: [],
      },
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

    const amountRaw = cell(row, mapping, "amount")
    const amount = Number(amountRaw)
    if (!amountRaw && amountRaw !== 0) {
      rowErrors.push("Amount is required")
    } else if (Number.isNaN(amount) || amount <= 0) {
      rowErrors.push("Amount must be a positive number")
    }

    const rawType = cell(row, mapping, "type")
    const type = normalizeType(rawType)
    if (!type) {
      rowErrors.push(`Invalid type "${rawType ?? ""}" (must be income, expense, or transfer)`)
    }

    const fromName = String(cell(row, mapping, "from_account") ?? "").trim()
    const toName = String(cell(row, mapping, "to_account") ?? "").trim()
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

    const sendCur =
      type && (fromAccount || toAccount)
        ? resolveRowCurrency({
            type,
            currencyRaw: cell(row, mapping, "currency"),
            fromAccount,
            toAccount,
            primary,
          })
        : String(cell(row, mapping, "currency") ?? "")
            .trim()
            .toUpperCase() || null

    let recvCur = null
    let receiveMajor = null
    if (type === "transfer" && toAccount) {
      recvCur = resolveReceiveCurrency({
        receiveCurrencyRaw: cell(row, mapping, "receive_currency"),
        toAccount,
        primary,
      })
      const receiveRaw = cell(row, mapping, "receive_amount")
      const receiveTrimmed =
        receiveRaw != null && String(receiveRaw).trim() !== "" ? String(receiveRaw).trim() : ""
      const isCross = sendCur && recvCur && sendCur !== recvCur

      if (isCross) {
        if (!receiveTrimmed) {
          rowErrors.push(
            "receive_amount is required when send and receive currencies differ"
          )
        } else {
          receiveMajor = Number(receiveRaw)
          if (!Number.isFinite(receiveMajor) || receiveMajor <= 0) {
            rowErrors.push("receive_amount must be a positive number")
          }
        }
      } else if (receiveTrimmed) {
        receiveMajor = Number(receiveRaw)
        if (!Number.isFinite(receiveMajor) || receiveMajor <= 0) {
          rowErrors.push("receive_amount must be a positive number")
        }
      } else if (Number.isFinite(amount) && amount > 0) {
        receiveMajor = amount
      }
    }

    const feeAmountRaw = cell(row, mapping, "fee_amount")
    const hasFeeColumn =
      feeAmountRaw != null && String(feeAmountRaw).trim() !== ""
    const feeMajor = hasFeeColumn ? parseOptionalFeeMajor(feeAmountRaw, true) : null
    if (hasFeeColumn && feeMajor === null) {
      rowErrors.push("fee_amount must be a positive number when provided")
    }

    const feeChargedToRaw = String(cell(row, mapping, "fee_charged_to") ?? "").trim()
    const feeChargeResolved =
      type === "transfer"
        ? resolveFeeChargedTo(feeChargedToRaw, fromAccount, toAccount)
        : { side: null, accountName: null }
    const feeChargedTo = feeChargeResolved.side
    const feeChargedToAccountName = feeChargeResolved.accountName

    if (type !== "transfer" && hasFeeColumn) {
      rowErrors.push("Fee columns apply only to transfer rows")
    }
    if (type === "transfer" && feeMajor != null && !feeChargedTo) {
      if (feeChargeResolved.ambiguous) {
        rowErrors.push(
          "fee_charged_to matches both from_account and to_account—use the full account name"
        )
      } else if (feeChargedToRaw) {
        rowErrors.push(
          `fee_charged_to must match from_account or to_account (got "${feeChargedToRaw}")`
        )
      } else {
        rowErrors.push(
          "fee_charged_to is required when fee_amount is set (use the paying account's name)"
        )
      }
    }

    let feeCurrency = null
    if (type === "transfer" && feeMajor != null && feeChargedTo) {
      const feeCurRaw = String(cell(row, mapping, "fee_currency") ?? "")
        .trim()
        .toUpperCase()
      feeCurrency = feeCurRaw
        ? feeCurRaw
        : defaultFeeCurrencyForSide(feeChargedTo, sendCur, recvCur)
      const feeAccount =
        feeChargedTo === FEE_CHARGE_TO ? toAccount : fromAccount
      if (feeAccount && !getAccountCurrencyOptions(feeAccount).includes(feeCurrency)) {
        rowErrors.push(
          `Fee currency ${feeCurrency} is not enabled on account "${feeAccount.name}"`
        )
      }
    }

    if (sendCur && fromAccount && (type === "expense" || type === "transfer")) {
      if (!getAccountCurrencyOptions(fromAccount).includes(sendCur)) {
        rowErrors.push(
          `Currency ${sendCur} is not enabled on account "${fromAccount.name}"`
        )
      }
    }
    if (sendCur && toAccount && type === "income") {
      if (!getAccountCurrencyOptions(toAccount).includes(sendCur)) {
        rowErrors.push(
          `Currency ${sendCur} is not enabled on account "${toAccount.name}"`
        )
      }
    }
    if (recvCur && toAccount && type === "transfer") {
      if (!getAccountCurrencyOptions(toAccount).includes(recvCur)) {
        rowErrors.push(
          `Receive currency ${recvCur} is not enabled on account "${toAccount.name}"`
        )
      }
    }

    const category = String(cell(row, mapping, "category") ?? "").trim()
    const subcategory = String(cell(row, mapping, "subcategory") ?? "").trim()

    if (type === "expense" && !category) {
      rowErrors.push("Category is required for expense")
    }

    const rawDate = cell(row, mapping, "date")
    const date =
      rawDate != null && String(rawDate).trim() !== ""
        ? parseExcelDate(rawDate)
        : toStoredDate(new Date())

    if (date === null) {
      rowErrors.push("Invalid date format (use MMM-DD-YYYY, e.g. AUG-01-2026)")
    }

    const notes = String(cell(row, mapping, "notes") ?? "").trim()

    const isValid = rowErrors.length === 0
    let payload = null

    if (isValid) {
      payload = buildLogicalRow({
        amount,
        type,
        category,
        subcategory,
        notes,
        date,
        currency: sendCur,
        receiveMajor,
        receiveCurrency: recvCur,
        feeMajor,
        feeCurrency,
        feeChargedTo,
        feeChargedToAccountName,
        from_account_id: fromAccount?.account_id ?? null,
        to_account_id: toAccount?.account_id ?? null,
        fromAccount,
        toAccount,
      })
      payload.importRowNum = rowNum
      validRows.push(payload)

      if (type === "income") totalIncome += amount
      else if (type === "expense") totalExpense += amount
      else if (type === "transfer") totalTransfer += amount
    } else {
      rowErrors.forEach((err) => {
        summaryErrors.push(`Row ${rowNum}: ${err}`)
      })
    }

    const transferReceiveLabel =
      type === "transfer" && receiveMajor != null && recvCur
        ? payload?.isCrossCurrency
          ? `${formatPreviewAmount(receiveMajor, recvCur)} (${sendCur} → ${recvCur})`
          : `${formatPreviewAmount(receiveMajor, recvCur)}`
        : "—"

    const feePayingAccount =
      feeChargedToAccountName ||
      (feeChargedTo === FEE_CHARGE_TO
        ? toAccount?.name
        : feeChargedTo === FEE_CHARGE_FROM
          ? fromAccount?.name
          : feeChargedToRaw || null)
    const feeLabel =
      feeMajor != null && feeCurrency
        ? `${formatPreviewAmount(feeMajor, feeCurrency)} · ${feePayingAccount || "—"}`
        : "—"

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
        category:
          category ||
          (type === "transfer" ? "Transfer out / Transfer in" : "—"),
        subcategory: subcategory || "—",
        currency: sendCur || "—",
        receiveLabel: transferReceiveLabel,
        feeLabel,
        date:
          isValid && date
            ? formatImportSpreadsheetDate(date)
            : rawDate != null && String(rawDate).trim()
              ? String(rawDate).trim()
              : "—",
        notes: notes || "—",
        payload,
      },
    })
  })

  if (!previewRows.length && !summaryErrors.length) {
    summaryErrors.push("No transaction rows found in the file.")
  }

  let finalValid = validRows
  let finalErrors = summaryErrors

  if (finalValid.length && accounts.length) {
    const balanceFindings = validateImportBalances(
      finalValid,
      accounts,
      existingTransactions
    )
    const merged = applyBalanceFindings(
      finalValid,
      previewRows,
      finalErrors,
      balanceFindings
    )
    finalValid = merged.validRows
    finalErrors = merged.summaryErrors
  }

  let statsIncome = 0
  let statsExpense = 0
  let statsTransfer = 0
  for (const r of finalValid) {
    if (r.type === "income") statsIncome += Number(r.amount) || 0
    else if (r.type === "expense") statsExpense += Number(r.amount) || 0
    else if (r.type === "transfer") statsTransfer += Number(r.amount) || 0
  }

  const byCurrency = summarizeByCurrency(finalValid)

  return {
    rows: finalValid,
    errors: finalErrors,
    previewRows,
    stats: {
      totalRows: previewRows.length,
      validCount: finalValid.length,
      invalidCount: previewRows.length - finalValid.length,
      totalIncome: statsIncome,
      totalExpense: statsExpense,
      totalTransfer: statsTransfer,
      byCurrency,
    },
  }
}

function formatPreviewAmount(major, currency) {
  const n = Number(major)
  if (!Number.isFinite(n)) return "—"
  return `${n} ${currency || ""}`.trim()
}

export function readTransactionsFromFile(
  file,
  accounts = [],
  primary = "PHP",
  existingTransactions = []
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: "array", cellDates: true })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
        resolve(parseTransactionRows(rows, accounts, primary, existingTransactions))
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
  const accountA = accountNames[0] ?? "Paypal"
  const accountB = accountNames[1] ?? "GoTyme"

  const d = (y, m, day) => formatImportSpreadsheetDateParts(y, m, day)

  const sample = [
    [
      d(2026, 6, 1),
      "income",
      "",
      30000,
      "PHP",
      accountB,
      "",
      "",
      "",
      "",
      "Salary",
      "",
      "Monthly pay",
    ],
    [
      d(2026, 6, 2),
      "expense",
      accountB,
      350,
      "PHP",
      "",
      "",
      "",
      "",
      "",
      "Food",
      "Groceries",
      "Market",
    ],
    [
      d(2026, 6, 3),
      "transfer",
      accountA,
      500,
      "PHP",
      accountB,
      "",
      "",
      accountA,
      15,
      "",
      "",
      "Same-currency transfer with fee on sender",
    ],
    [
      d(2026, 6, 4),
      "transfer",
      accountA,
      100,
      "USD",
      accountB,
      5800,
      "PHP",
      accountB,
      25,
      "",
      "",
      "Cross-currency: 100 USD sent, 5800 PHP received, fee on receiver",
    ],
  ]

  const txSheet = XLSX.utils.aoa_to_sheet([headers, ...sample])
  txSheet["!cols"] = [
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 10 },
    { wch: 8 },
    { wch: 16 },
    { wch: 14 },
    { wch: 10 },
    { wch: 16 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 40 },
  ]

  const guideHeader = ["Column", "Required", "What to enter"]
  const guideRows = TEMPLATE_COLUMNS.map((c) => [
    c.name,
    c.required ? "Yes" : "No",
    c.description,
  ])
  const advancedRows = IMPORT_ADVANCED_COLUMNS.map((c) => [
    c.name,
    "Advanced",
    c.description,
  ])
  const guideSheet = XLSX.utils.aoa_to_sheet([
    guideHeader,
    ...guideRows,
    [],
    ["Optional columns (not in template sheet)"],
    ...advancedRows,
    [],
    ["Tips"],
    ...IMPORT_GUIDE_TIPS.map((tip) => [`• ${tip}`]),
  ])
  guideSheet["!cols"] = [{ wch: 18 }, { wch: 10 }, { wch: 78 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, txSheet, "Transactions")
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Column guide")
  XLSX.writeFile(workbook, "transaction-import-template.xlsx")
}
