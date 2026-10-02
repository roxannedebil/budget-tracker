import { applyTransactionToRunningBalances } from "./accountStats.js"
import { parseDateInputValue } from "./formatDate.js"
import { FEE_CHARGE_FROM, FEE_CHARGE_TO } from "./transferFee.js"

const EPS = 1e-6

function balanceKey(accountId, currency) {
  return `${accountId}|${String(currency || "PHP").toUpperCase()}`
}

function accountLabel(accounts, accountId) {
  return accounts.find((a) => a.account_id === accountId)?.name ?? "Account"
}

/** Calendar-day sort key (ignores time-of-day on stored ISO strings). */
function calendarDateMs(value) {
  const d = parseDateInputValue(value)
  return d ? d.getTime() : 0
}

function stableExistingTie(tx) {
  const id = tx?.transaction_id ?? tx?.id
  if (id == null) return 0
  const s = String(id)
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function compareSimulationEvents(a, b) {
  if (a.dateMs !== b.dateMs) return a.dateMs - b.dateMs
  // Same date: existing ledger first, then import rows by sheet row number
  if (a.kind !== b.kind) return a.kind === "existing" ? -1 : 1
  return a.tie - b.tie
}

function getBalance(balances, accountId, currency) {
  if (!accountId) return 0
  return balances.get(balanceKey(accountId, currency)) ?? 0
}

function credit(balances, accountId, currency, amountMajor) {
  const amount = Number(amountMajor)
  if (!accountId || !Number.isFinite(amount) || amount <= 0) return
  const key = balanceKey(accountId, currency)
  balances.set(key, getBalance(balances, accountId, currency) + amount)
}

function tryDebit(balances, accountId, currency, amountMajor) {
  const amount = Number(amountMajor)
  if (!accountId || !Number.isFinite(amount) || amount <= 0) return null
  const cur = String(currency || "PHP").toUpperCase()
  const have = getBalance(balances, accountId, cur)
  if (have + EPS < amount) {
    return { accountId, currency: cur, have, need: amount }
  }
  balances.set(balanceKey(accountId, cur), have - amount)
  return null
}

function simulateImportTransferRow(balances, row, accounts) {
  const rowErrors = []
  const name = (id) => accountLabel(accounts, id)

  const sendCur = String(row.currency || "PHP").toUpperCase()
  const recvCur = String(row.receiveCurrency || sendCur).toUpperCase()
  const sendMajor = Number(row.amount)
  const recvMajor = Number(row.receiveMajor)
  const feeMajor =
    row.feeMajor != null && Number(row.feeMajor) > 0 ? Number(row.feeMajor) : null
  const feeCur = String(row.feeCurrency || recvCur || sendCur).toUpperCase()
  const chargedTo = row.feeChargedTo

  const sendShort = tryDebit(balances, row.from_account_id, sendCur, sendMajor)
  if (sendShort) {
    rowErrors.push(
      `Insufficient balance on "${name(sendShort.accountId)}" to send transfer: need ${sendShort.need} ${sendShort.currency}, have ${formatAvail(sendShort.have)} ${sendShort.currency} (as of this row's date)`
    )
  }

  if (feeMajor != null && chargedTo === FEE_CHARGE_FROM) {
    const feeShort = tryDebit(balances, row.from_account_id, feeCur, feeMajor)
    if (feeShort) {
      rowErrors.push(
        `Insufficient balance on "${name(feeShort.accountId)}" for transfer fee: need ${feeShort.need} ${feeShort.currency}, have ${formatAvail(feeShort.have)} ${feeShort.currency} (as of this row's date)`
      )
    }
  }

  credit(balances, row.to_account_id, recvCur, recvMajor)

  if (feeMajor != null && chargedTo === FEE_CHARGE_TO) {
    if (feeCur === recvCur) {
      if (recvMajor + EPS < feeMajor) {
        rowErrors.push(
          `receive_amount (${formatAvail(recvMajor)} ${recvCur}) must cover the fee (${formatAvail(feeMajor)} ${feeCur}) when fee_charged_to is the receiving account`
        )
      } else {
        tryDebit(balances, row.to_account_id, feeCur, feeMajor)
      }
    } else {
      const feeShort = tryDebit(balances, row.to_account_id, feeCur, feeMajor)
      if (feeShort) {
        rowErrors.push(
          `Insufficient ${feeShort.currency} on "${name(feeShort.accountId)}" for the fee after receive: need ${feeShort.need}, have ${formatAvail(feeShort.have)} (as of this row's date)`
        )
      }
    }
  }

  return rowErrors
}

function simulateImportRow(balances, row, accounts) {
  if (row.type === "income") {
    credit(balances, row.to_account_id, row.currency, row.amount)
    return []
  }
  if (row.type === "expense") {
    const name = (id) => accountLabel(accounts, id)
    const short = tryDebit(balances, row.from_account_id, row.currency, row.amount)
    if (short) {
      return [
        `Insufficient balance on "${name(short.accountId)}": need ${short.need} ${short.currency}, have ${formatAvail(short.have)} ${short.currency} (as of this row's date)`,
      ]
    }
    return []
  }
  if (row.type === "transfer") {
    return simulateImportTransferRow(balances, row, accounts)
  }
  return []
}

/**
 * Walk existing + import rows in date order (not spreadsheet row order).
 * Running balance only includes activity on or before each row's date.
 */
export function validateImportBalances(validRows, accounts, existingTransactions = []) {
  if (!validRows?.length) return []

  const events = []

  for (const tx of existingTransactions) {
    events.push({
      kind: "existing",
      dateMs: calendarDateMs(tx.date),
      tie: stableExistingTie(tx),
      tx,
    })
  }

  for (const row of validRows) {
    events.push({
      kind: "import",
      dateMs: calendarDateMs(row.date),
      tie: row.importRowNum || 0,
      row,
    })
  }

  events.sort(compareSimulationEvents)

  const balances = new Map()
  const findings = []

  for (const event of events) {
    if (event.kind === "existing") {
      applyTransactionToRunningBalances(balances, event.tx, balanceKey)
      continue
    }

    const rowErrors = simulateImportRow(balances, event.row, accounts)
    if (rowErrors.length) {
      findings.push({ rowNum: event.row.importRowNum, errors: rowErrors })
    }
  }

  return findings
}

function formatAvail(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return "0"
  return String(Math.round(v * 100) / 100)
}
