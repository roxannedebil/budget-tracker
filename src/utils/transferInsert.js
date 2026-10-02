import { majorToMinor, signedMinorForType } from "./currency.js"

export const TRANSFER_CATEGORY_LEGACY = "Transfer"
export const TRANSFER_CATEGORY_OUT = "Transfer out"
export const TRANSFER_CATEGORY_IN = "Transfer in"

export function categoryForTransferType(type) {
  if (type === "transfer_out") return TRANSFER_CATEGORY_OUT
  if (type === "transfer_in") return TRANSFER_CATEGORY_IN
  return TRANSFER_CATEGORY_LEGACY
}

function uuid() {
  return crypto.randomUUID()
}

export function shouldUseSplitTransfer({ sendCurrency, receiveCurrency, status }) {
  if ((sendCurrency || "PHP").toUpperCase() !== (receiveCurrency || "PHP").toUpperCase()) {
    return true
  }
  if (status === "pending") return true
  return false
}

/** Header row in `transfers` (cross-currency, pending, or same-currency with a fee). */
export function shouldCreateTransferHeader({
  sendCurrency,
  receiveCurrency,
  status,
  hasFee,
}) {
  if (shouldUseSplitTransfer({ sendCurrency, receiveCurrency, status })) return true
  return Boolean(hasFee)
}

export function parseOptionalFeeMajor(feeInput, feeEnabled) {
  if (!feeEnabled) return null
  const raw = String(feeInput ?? "").trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/** Net moved to the other account: amount sent − fee (fee in send currency). */
export function netTransferSendMajor(grossSentMajor, feeMajor) {
  const gross = Number(grossSentMajor)
  const fee = feeMajor != null ? Number(feeMajor) : 0
  if (!Number.isFinite(gross)) return null
  return gross - (Number.isFinite(fee) ? fee : 0)
}

export function buildTransferFeeRow({
  userId,
  transferId,
  feeMajor,
  sendCurrency,
  fromAccountId,
  date,
  notes,
  rateToBase,
  status,
}) {
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  return {
    user_id: userId,
    type: "fee",
    amount: Number(feeMajor),
    amount_minor: signedMinorForType("fee", feeMajor, sendCur),
    currency: sendCur,
    rate_to_base: rateToBase,
    category: "Fees",
    subcategory: null,
    notes: notes || null,
    date,
    status: status || "completed",
    from_account_id: fromAccountId,
    to_account_id: null,
    transfer_group_id: transferId,
    transfer_id: transferId,
    income_source: null,
  }
}

export function buildTransferHeader({
  transferId,
  userId,
  status,
  fromAccountId,
  toAccountId,
  sendCurrency,
  receiveCurrency,
  date,
  notes,
  pendingFeeMajor = null,
  pendingFeeCurrency = null,
  pendingFeeAccountId = null,
}) {
  const header = {
    transfer_id: transferId,
    user_id: userId,
    status: status || "pending",
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    send_currency: (sendCurrency || "PHP").toUpperCase(),
    receive_currency: (receiveCurrency || "PHP").toUpperCase(),
    date,
    notes: notes || null,
  }
  if (pendingFeeMajor != null && Number(pendingFeeMajor) > 0) {
    header.pending_fee_major = Number(pendingFeeMajor)
    header.pending_fee_currency = (pendingFeeCurrency || "PHP").toUpperCase()
    header.pending_fee_account_id = pendingFeeAccountId
  }
  return header
}

/** Pending split transfer: transfer_out leg only (transfer_in added on complete). */
export function buildPendingTransferOutRow({
  userId,
  transferId,
  sendMajor,
  sendCurrency,
  receiveCurrency,
  receiveMajor,
  fromAccountId,
  toAccountId,
  notes,
  date,
  marketRateEstimate,
  effectiveRate,
  rateToBaseSend,
  subcategory = null,
}) {
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || "PHP").toUpperCase()
  const plannedRecv =
    receiveMajor != null && Number(receiveMajor) > 0 ? Number(receiveMajor) : null

  return {
    user_id: userId,
    type: "transfer_out",
    amount: Number(sendMajor),
    amount_minor: signedMinorForType("transfer_out", sendMajor, sendCur),
    currency: sendCur,
    rate_to_base: rateToBaseSend,
    category: TRANSFER_CATEGORY_OUT,
    subcategory,
    notes,
    date,
    status: "pending",
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    transfer_group_id: transferId,
    transfer_id: transferId,
    received_amount_minor: plannedRecv != null ? majorToMinor(plannedRecv, recvCur) : null,
    market_rate_estimate: marketRateEstimate,
    effective_rate: effectiveRate ?? null,
    income_source: null,
  }
}

export function buildTransferRows({
  userId,
  transferId,
  sendMajor,
  receiveMajor,
  sendCurrency,
  receiveCurrency,
  fromAccountId,
  toAccountId,
  notes,
  date,
  status,
  marketRateEstimate,
  effectiveRate,
  rateToBaseSend,
  rateToBaseReceive,
}) {
  const groupId = transferId || uuid()
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || "PHP").toUpperCase()
  const base = {
    user_id: userId,
    subcategory: null,
    notes,
    date,
    status: status || "completed",
    transfer_group_id: groupId,
    transfer_id: groupId,
    income_source: null,
  }

  const sendMinor = signedMinorForType("transfer_out", sendMajor, sendCur)
  const recvMinor = signedMinorForType("transfer_in", receiveMajor, recvCur)

  return [
    {
      ...base,
      category: TRANSFER_CATEGORY_OUT,
      type: "transfer_out",
      amount: Number(sendMajor),
      amount_minor: sendMinor,
      currency: sendCur,
      rate_to_base: rateToBaseSend,
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      received_amount_minor: majorToMinor(receiveMajor, recvCur),
      market_rate_estimate: marketRateEstimate,
      effective_rate: effectiveRate,
    },
    {
      ...base,
      category: TRANSFER_CATEGORY_IN,
      type: "transfer_in",
      amount: Number(receiveMajor),
      amount_minor: recvMinor,
      currency: recvCur,
      rate_to_base: rateToBaseReceive,
      from_account_id: null,
      to_account_id: toAccountId,
      received_amount_minor: majorToMinor(receiveMajor, recvCur),
      market_rate_estimate: marketRateEstimate,
      effective_rate: effectiveRate,
    },
  ]
}

export function buildSimpleTransferRow({
  userId,
  amountMajor,
  currency,
  fromAccountId,
  toAccountId,
  notes,
  date,
  rateToBase,
  transferId = null,
}) {
  const cur = (currency || "PHP").toUpperCase()
  const row = {
    user_id: userId,
    type: "transfer",
    amount: Number(amountMajor),
    amount_minor: signedMinorForType("transfer", amountMajor, cur),
    currency: cur,
    rate_to_base: rateToBase,
    category: TRANSFER_CATEGORY_LEGACY,
    subcategory: null,
    notes,
    date,
    status: "completed",
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    income_source: null,
  }
  if (transferId) {
    row.transfer_id = transferId
    row.transfer_group_id = transferId
  }
  return row
}
