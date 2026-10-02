import { accountDefaultCurrency } from "./accountCurrencies.js"
import {
  formatCurrency,
  getTransactionMajorAbs,
  minorToMajor,
} from "./currency"
import { currencyInputPrefix } from "./currencySymbol"
import {
  getTransferLegs,
  resolveTransferActionTarget,
} from "./transferLifecycle.js"

/** 1 unit of `from` → how many `to`, using table where base is primary. */
export function convertMajorUsingRatesTable(amount, from, to, table) {
  const n = Number(amount)
  if (!Number.isFinite(n) || from === to) return n
  if (!table?.rates) return NaN

  const base = table.base
  const rates = table.rates

  if (from === base && rates[to] != null) return n * rates[to]
  if (to === base && rates[from] != null) return n / rates[from]

  const inBase = from === base ? n : n / rates[from]
  if (to === base) return inBase
  if (rates[to] != null) return inBase * rates[to]
  return NaN
}

/** Receive major units per 1 send major unit. */
export function receivePerSendUnit(sendMajor, receiveMajor) {
  const send = Number(sendMajor)
  const recv = Number(receiveMajor)
  if (!Number.isFinite(send) || send <= 0 || !Number.isFinite(recv) || recv <= 0) {
    return null
  }
  return recv / send
}

function formatOneUnit(currencyCode) {
  const code = (currencyCode || "PHP").toUpperCase()
  const sym = currencyInputPrefix(code)
  return `${sym}1`
}

/** Pick the currency shown as “per 1 unit” (prefer non-primary leg of the pair). */
export function pickRateUnitCurrency(primary, sendCurrency, receiveCurrency) {
  const primaryU = (primary || "PHP").toUpperCase()
  const send = (sendCurrency || "PHP").toUpperCase()
  const recv = (receiveCurrency || "PHP").toUpperCase()
  const nonPrimary = [send, recv].find((c) => c !== primaryU)
  if (nonPrimary) return nonPrimary
  return send !== recv ? recv : send
}

/**
 * Human-readable rate, e.g. "₱58.50 per $1".
 * `recvPerSend` = receive currency major per 1 send major.
 */
export function formatReadableExchangeRate({
  primary,
  sendCurrency,
  receiveCurrency,
  recvPerSend,
}) {
  const rate = Number(recvPerSend)
  if (!Number.isFinite(rate) || rate <= 0) return null

  const send = (sendCurrency || "PHP").toUpperCase()
  const recv = (receiveCurrency || "PHP").toUpperCase()
  const unit = pickRateUnitCurrency(primary, send, recv)

  if (unit === send) {
    return `${formatCurrency(rate, recv)} per ${formatOneUnit(send)}`
  }
  const inv = 1 / rate
  return `${formatCurrency(inv, send)} per ${formatOneUnit(recv)}`
}

const MARKET_RATE_WARN_THRESHOLD = 0.1

/** Warn if effective rate deviates >10% from market (same direction as readable rate). */
export function marketRateDeviationWarning({
  primary,
  sendCurrency,
  receiveCurrency,
  recvPerSendEffective,
  recvPerSendMarket,
}) {
  const eff = Number(recvPerSendEffective)
  const mkt = Number(recvPerSendMarket)
  if (!Number.isFinite(eff) || !Number.isFinite(mkt) || mkt <= 0) return null

  const unit = pickRateUnitCurrency(primary, sendCurrency, receiveCurrency)
  const send = (sendCurrency || "PHP").toUpperCase()
  const effDisplay = unit === send ? eff : 1 / eff
  const mktDisplay = unit === send ? mkt : 1 / mkt
  if (!Number.isFinite(effDisplay) || !Number.isFinite(mktDisplay) || mktDisplay <= 0) {
    return null
  }

  const rel = Math.abs(effDisplay - mktDisplay) / mktDisplay
  if (rel <= MARKET_RATE_WARN_THRESHOLD) return null
  return "This is far from the market estimate. Double-check the amount."
}

export function isCrossCurrencyTransferRow(transaction, allTransactions = []) {
  if (!transaction) return false
  const type = transaction.type
  if (type === "transfer") return false
  if (type !== "transfer_out" && type !== "transfer_in") return false

  const groupId = transaction.transfer_id || transaction.transfer_group_id
  if (!groupId) {
    return Boolean(transaction.effective_rate)
  }

  const group = allTransactions.filter(
    (t) => t.transfer_id === groupId || t.transfer_group_id === groupId
  )
  const out = group.find((t) => t.type === "transfer_out")
  const inn = group.find((t) => t.type === "transfer_in")
  if (out && inn) {
    return (out.currency || "PHP").toUpperCase() !== (inn.currency || "PHP").toUpperCase()
  }
  return false
}

/** FX summary for transfer detail view (completed or pending). */
export function getTransferFxDetails(
  transaction,
  allTransactions = [],
  { primary = "PHP", accounts = [] } = {}
) {
  if (!transaction) return null

  const target = resolveTransferActionTarget(transaction, allTransactions) ?? transaction
  const legs = getTransferLegs(target, allTransactions)
  let out = legs.find((t) => t.type === "transfer_out")
  let inn = legs.find((t) => t.type === "transfer_in")

  if (!out && target.type === "transfer_out") out = target
  if (!inn && target.type === "transfer_in") inn = target
  if (target.type === "transfer" && !getTransferKeySafe(target)) return null
  if (!out) return null

  const sendCur = (out.currency || "PHP").toUpperCase()
  let recvCur = sendCur
  if (inn) {
    recvCur = (inn.currency || sendCur).toUpperCase()
  } else {
    const toAccount = accounts.find((a) => a.account_id === out.to_account_id)
    recvCur = accountDefaultCurrency(toAccount, primary).toUpperCase()
  }

  if (sendCur === recvCur) return null

  const sendMajor = getTransactionMajorAbs(out)
  let receiveMajor = null
  if (inn) {
    receiveMajor = getTransactionMajorAbs(inn)
  } else if (out.received_amount_minor != null && out.received_amount_minor !== "") {
    receiveMajor = minorToMajor(out.received_amount_minor, recvCur)
  }

  const marketEstimateMajor =
    out.market_rate_estimate != null && Number(out.market_rate_estimate) > 0
      ? Number(out.market_rate_estimate)
      : null

  let recvPerSend = null
  if (inn?.effective_rate != null && Number(inn.effective_rate) > 0) {
    recvPerSend = Number(inn.effective_rate)
  } else if (out.effective_rate != null && Number(out.effective_rate) > 0) {
    recvPerSend = Number(out.effective_rate)
  } else {
    recvPerSend = receivePerSendUnit(sendMajor, receiveMajor)
  }

  const rateLabel =
    recvPerSend != null
      ? formatReadableExchangeRate({
          primary,
          sendCurrency: sendCur,
          receiveCurrency: recvCur,
          recvPerSend,
        })
      : null

  const marketImpliedRecvPerSend =
    marketEstimateMajor != null && sendMajor > 0
      ? receivePerSendUnit(sendMajor, marketEstimateMajor)
      : null
  const marketRateReferenceLabel =
    marketImpliedRecvPerSend != null
      ? formatReadableExchangeRate({
          primary,
          sendCurrency: sendCur,
          receiveCurrency: recvCur,
          recvPerSend: marketImpliedRecvPerSend,
        })
      : null

  return {
    sendCurrency: sendCur,
    receiveCurrency: recvCur,
    marketEstimateMajor,
    marketEstimateLabel:
      marketEstimateMajor != null
        ? formatCurrency(marketEstimateMajor, recvCur)
        : null,
    marketRateReferenceLabel,
    recvPerSend,
    rateLabel,
    status: out.status || inn?.status || "completed",
  }
}

function getTransferKeySafe(transaction) {
  return transaction?.transfer_id || transaction?.transfer_group_id || null
}

export { getTransferGroupTransactionIds as getTransferGroupIds } from "./transferLifecycle"
