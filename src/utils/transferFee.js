import { getAccountCurrencyOptions } from "./accountCurrencies.js"
import { formatCurrency, isPositiveMoneyAmount } from "./currency.js"
import { resolveRateToBase } from "./transactionPayload.js"
import { parseOptionalFeeMajor, buildTransferFeeRow } from "./transferInsert.js"
import { feePlanToPersistedFee, parseFeePlanFromSubcategory } from "./transferFeePlan.js"

export const FEE_CHARGE_FROM = "from"
export const FEE_CHARGE_TO = "to"

export function defaultFeeCurrencyForSide(chargedTo, sendCurrency, receiveCurrency) {
  const send = (sendCurrency || "PHP").toUpperCase()
  const recv = (receiveCurrency || "PHP").toUpperCase()
  return chargedTo === FEE_CHARGE_TO ? recv : send
}

export function feeCurrencyOptionsForSide(chargedTo, fromAccount, toAccount) {
  const account = chargedTo === FEE_CHARGE_TO ? toAccount : fromAccount
  return getAccountCurrencyOptions(account)
}

export function resolveFeeAccountId(chargedTo, fromAccountId, toAccountId) {
  return chargedTo === FEE_CHARGE_TO ? toAccountId : fromAccountId
}

/** Pending transfers keep fee on header/plan until complete (no fee leg yet). */
export function shouldDeferFeeRow({
  hasFee,
  transferStatus,
}) {
  if (!hasFee) return false
  return transferStatus === "pending"
}

export function buildTransferFeeRowForTransfer({
  userId,
  transferId,
  feeMajor,
  feeCurrency,
  feeAccountId,
  date,
  notes,
  rateToBase,
  status,
}) {
  return buildTransferFeeRow({
    userId,
    transferId,
    feeMajor,
    sendCurrency: feeCurrency,
    fromAccountId: feeAccountId,
    date,
    notes,
    rateToBase,
    status,
  })
}

export function buildPendingFeeHeaderFields({
  feeMajor,
  feeCurrency,
  feeAccountId,
  transferStatus,
}) {
  if (feeMajor == null || transferStatus !== "pending") return {}
  return {
    pending_fee_major: Number(feeMajor),
    pending_fee_currency: (feeCurrency || "PHP").toUpperCase(),
    pending_fee_account_id: feeAccountId,
  }
}

export function buildTransferBalancePreview({
  fromAccountName,
  toAccountName,
  sendMajor,
  sendCurrency,
  receiveMajor,
  receiveCurrency,
  isCrossCurrency,
  transferStatus,
  feeMajor,
  feeCurrency,
  chargedTo,
  deferFee,
  netReceiveMajor,
  netReceiveCurrency,
}) {
  const lines = []
  const sent = Number(sendMajor)
  const recv = isCrossCurrency ? Number(receiveMajor) : sent
  const fee = feeMajor != null ? Number(feeMajor) : 0
  const feeCur = (feeCurrency || sendCurrency || "PHP").toUpperCase()
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || sendCur).toUpperCase()

  if (!fromAccountName || !Number.isFinite(sent) || sent <= 0) return lines

  let fromDebit = sent
  if (fee > 0 && chargedTo === FEE_CHARGE_FROM && !deferFee) {
    if (feeCur === sendCur) fromDebit += fee
  }
  lines.push(
    `${fromAccountName}: your balance will decrease by ${formatCurrency(fromDebit, sendCur)}`
  )

  const feeOnTo = fee > 0 && chargedTo === FEE_CHARGE_TO
  const net =
    netReceiveMajor != null && Number.isFinite(Number(netReceiveMajor))
      ? Number(netReceiveMajor)
      : null
  const netCur = (netReceiveCurrency || recvCur).toUpperCase()

  if (toAccountName && net != null && net >= 0) {
    if (transferStatus === "pending") {
      lines.push(
        `${toAccountName}: ${formatCurrency(net, netCur)} will be added when you mark this transfer as Completed.`
      )
    } else {
      lines.push(
        `${toAccountName}: your balance will increase by ${formatCurrency(net, netCur)}`
      )
    }
  } else {
    const showToCredit =
      toAccountName && transferStatus === "completed" && Number.isFinite(recv) && recv > 0

    if (showToCredit && feeOnTo && !deferFee) {
      lines.push(
        `${toAccountName}: ${formatCurrency(recv, recvCur)} arrives, then ${formatCurrency(fee, feeCur)} fee is deducted`
      )
    } else if (showToCredit) {
      lines.push(
        `${toAccountName}: your balance will increase by ${formatCurrency(recv, recvCur)}`
      )
    }
  }

  if (feeOnTo && deferFee) {
    lines.push(
      `${toAccountName}: a ${formatCurrency(fee, feeCur)} fee will be deducted when you complete this transfer`
    )
  } else if (fee > 0 && chargedTo === FEE_CHARGE_FROM && feeCur !== sendCur && !deferFee) {
    lines.push(
      `${fromAccountName}: an extra ${formatCurrency(fee, feeCur)} fee will also come off this account`
    )
  }

  return lines
}

export function validateTransferFeeInput({
  showFee,
  feeAmount,
  chargedTo,
  feeCurrency,
  fromAccount,
  toAccount,
}) {
  const feeTrimmed = showFee ? String(feeAmount ?? "").trim() : ""
  const feeMajor = showFee ? parseOptionalFeeMajor(feeAmount, true) : null
  if (showFee && feeTrimmed && feeMajor === null) {
    return "Enter a fee greater than zero, or leave the fee empty."
  }
  if (feeMajor != null) {
    const options = feeCurrencyOptionsForSide(chargedTo, fromAccount, toAccount)
    const cur = (feeCurrency || "").toUpperCase()
    if (!options.includes(cur)) {
      return "Choose a fee currency that this account holds."
    }
  }
  return null
}

export function validateToBalanceForFee({
  toAccountId,
  feeMajor,
  feeCurrency,
  receiveCurrency,
  chargedTo,
  deferFee,
  transferStatus,
  transactions,
  getBalance,
}) {
  if (feeMajor == null || chargedTo !== FEE_CHARGE_TO || deferFee) return null
  if (transferStatus !== "completed") return null
  const feeCur = (feeCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || feeCur).toUpperCase()
  if (feeCur === recvCur) return null
  const fee = Number(feeMajor)
  const available = getBalance(toAccountId, transactions, feeCur)
  if (fee > available + 1e-9) {
    return `Not enough ${feeCur} on the receiving account for the fee. Available: ${formatCurrency(available, feeCur)}.`
  }
  return null
}

export function validateFromBalanceForTransfer({
  fromAccountId,
  sendCurrency,
  sendMajor,
  feeMajor,
  feeCurrency,
  chargedTo,
  deferFee,
  transactions,
  getBalance,
}) {
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  const availableSend = getBalance(fromAccountId, transactions, sendCur)
  const sent = Number(sendMajor)
  if (sent > availableSend + 1e-9) {
    return `Not enough ${sendCur} on the sending account. Available: ${formatCurrency(availableSend, sendCur)}.`
  }
  if (feeMajor == null || chargedTo !== FEE_CHARGE_FROM || deferFee) return null
  const feeCur = (feeCurrency || sendCur).toUpperCase()
  const fee = Number(feeMajor)
  if (feeCur === sendCur) {
    if (sent + fee > availableSend + 1e-9) {
      return `Not enough ${sendCur} for the transfer and fee. Available: ${formatCurrency(availableSend, sendCur)}.`
    }
    return null
  }
  const availableFee = getBalance(fromAccountId, transactions, feeCur)
  if (fee > availableFee + 1e-9) {
    return `Not enough ${feeCur} for the fee. Available: ${formatCurrency(availableFee, feeCur)}.`
  }
  return null
}

export function buildFeeHelperText(accountName, currencyCode) {
  const name = accountName || "this account"
  const code = (currencyCode || "PHP").toUpperCase()
  return `Charged to: ${name} in ${code}, on top of the transfer. If the fee was already taken out of the amount that arrived, leave this empty and enter the net amount received instead. If the fee was charged in a different currency than the one this account holds, enter the amount actually deducted from this account.`
}

function convertMajorUsingRatesTable(amount, from, to, table) {
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

function feeDeductionInReceiveCurrency({
  feeMajor,
  feeCurrency,
  receiveCurrency,
  chargedTo,
  deferFee,
  ratesTable,
}) {
  if (feeMajor == null || Number(feeMajor) <= 0 || deferFee) return 0
  if (chargedTo !== FEE_CHARGE_TO) return 0

  const feeCur = (feeCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || "PHP").toUpperCase()
  if (feeCur === recvCur) return Number(feeMajor)

  if (!ratesTable?.rates) return NaN
  const converted = convertMajorUsingRatesTable(
    Number(feeMajor),
    feeCur,
    recvCur,
    ratesTable
  )
  return Number.isFinite(converted) ? converted : NaN
}

/**
 * Net amount credited to the To account in receive currency (after fee on To).
 * Fee on From is on top of send and does not reduce the receive leg.
 */
export function computeTransferNetReceivePreview({
  sendMajor,
  sendCurrency,
  receiveCurrency,
  receiveMajorGross,
  isCrossCurrency,
  transferStatus,
  feeMajor,
  feeCurrency,
  chargedTo,
  deferFee,
  ratesTable,
  marketReceiveEstimateGross = null,
}) {
  const sendCur = (sendCurrency || "PHP").toUpperCase()
  const recvCur = (receiveCurrency || sendCurrency || "PHP").toUpperCase()
  const sent = Number(sendMajor)

  if (!Number.isFinite(sent) || sent <= 0) {
    return {
      netMajor: null,
      grossMajor: null,
      receiveCurrency: recvCur,
      feeDeductionMajor: 0,
      note: "needSend",
    }
  }

  let grossMajor
  let note = null

  if (!isCrossCurrency) {
    grossMajor = sent
  } else if (isPositiveMoneyAmount(receiveMajorGross)) {
    grossMajor = Number(receiveMajorGross)
  } else if (
    marketReceiveEstimateGross != null &&
    Number(marketReceiveEstimateGross) > 0
  ) {
    grossMajor = Number(marketReceiveEstimateGross)
    note = "estimate"
  } else {
    const converted = convertMajorUsingRatesTable(sent, sendCur, recvCur, ratesTable)
    if (Number.isFinite(converted) && converted > 0) {
      grossMajor = converted
      note = "estimate"
    } else {
      return {
        netMajor: null,
        grossMajor: null,
        receiveCurrency: recvCur,
        feeDeductionMajor: 0,
        note: "needReceive",
      }
    }
  }

  // Net preview always subtracts fee on To, even when the fee row is deferred until complete.
  const feeDed = feeDeductionInReceiveCurrency({
    feeMajor,
    feeCurrency,
    receiveCurrency: recvCur,
    chargedTo,
    deferFee: false,
    ratesTable,
  })

  if (Number.isNaN(feeDed)) {
    return {
      netMajor: grossMajor,
      grossMajor,
      receiveCurrency: recvCur,
      feeDeductionMajor: 0,
      note: transferStatus === "pending" ? "pendingNoRate" : "noRate",
    }
  }

  const netMajor = Math.max(0, grossMajor - feeDed)
  const feeDeductionMajor = feeDed > 0 ? feeDed : 0

  if (transferStatus === "pending") {
    note = note === "estimate" ? "pendingEstimate" : "pendingPreview"
  }

  return {
    netMajor,
    grossMajor,
    receiveCurrency: recvCur,
    feeDeductionMajor,
    note,
  }
}

export function pendingFeeFromHeader(header) {
  if (!header?.pending_fee_major || Number(header.pending_fee_major) <= 0) return null
  return {
    major: Number(header.pending_fee_major),
    currency: (header.pending_fee_currency || "PHP").toUpperCase(),
    accountId: header.pending_fee_account_id,
  }
}

/** Fee saved on create (fee row and/or transfers header pending_fee_*). */
export function resolvePersistedPendingFee(existingFeeRow, transferHeader, transferOut) {
  const toId = transferOut?.to_account_id ?? null
  if (existingFeeRow) {
    const major = Math.abs(Number(existingFeeRow.amount))
    if (!Number.isFinite(major) || major <= 0) return null
    const currency = (existingFeeRow.currency || "PHP").toUpperCase()
    const chargedTo =
      existingFeeRow.from_account_id != null &&
      toId != null &&
      String(existingFeeRow.from_account_id) === String(toId)
        ? FEE_CHARGE_TO
        : FEE_CHARGE_FROM
    return { major, currency, chargedTo, source: "row" }
  }
  const pending = pendingFeeFromHeader(transferHeader)
  if (pending) {
    const chargedTo =
      pending.accountId != null &&
      toId != null &&
      String(pending.accountId) === String(toId)
        ? FEE_CHARGE_TO
        : FEE_CHARGE_FROM
    return {
      major: pending.major,
      currency: pending.currency,
      chargedTo,
      source: "header",
    }
  }
  const plan = parseFeePlanFromSubcategory(transferOut?.subcategory)
  const fromPlan = feePlanToPersistedFee(plan, transferOut)
  if (fromPlan) return fromPlan
  return null
}

/** Stepper form state overrides persisted fee when user edited step 2. */
export function resolveEffectivePendingFee({
  showFee,
  feeAmount,
  feeCurrency,
  feeChargedTo,
  persistedFee,
}) {
  const fromForm = showFee ? parseOptionalFeeMajor(feeAmount, true) : null
  if (fromForm != null) {
    return {
      major: fromForm,
      currency: (feeCurrency || "PHP").toUpperCase(),
      chargedTo: feeChargedTo,
      fromForm: true,
    }
  }
  if (persistedFee) {
    return {
      major: persistedFee.major,
      currency: persistedFee.currency,
      chargedTo: persistedFee.chargedTo,
      fromForm: false,
    }
  }
  return null
}

/** Apply fee changes for a pending transfer (immediate fee row and/or header pending_fee_*). */
export async function syncPendingTransferFee({
  supabaseClient,
  userId,
  transferKey,
  showFee,
  feeAmount,
  feeChargedTo,
  feeCurrency,
  sendCur,
  recvCur,
  fromAccountId,
  toAccountId,
  storedDate,
  notes,
  ratesTable,
  primary,
  existingFeeRow,
  isTransfersTableMissing,
  withTransferFeeSqlHint,
}) {
  const feeMajor = showFee ? parseOptionalFeeMajor(feeAmount, true) : null
  const isCrossCurrency =
    (sendCur || "PHP").toUpperCase() !== (recvCur || "PHP").toUpperCase()
  const deferFee = shouldDeferFeeRow({
    hasFee: feeMajor != null,
    chargedTo: feeChargedTo,
    transferStatus: "pending",
    isCrossCurrency,
  })
  const feeAccountId = resolveFeeAccountId(feeChargedTo, fromAccountId, toAccountId)
  const feeCur = (feeCurrency || sendCur || "PHP").toUpperCase()
  const feeRowId = existingFeeRow?.transaction_id ?? existingFeeRow?.id

  if (transferKey) {
    const { error: headerError } = await supabaseClient
      .from("transfers")
      .update({
        pending_fee_major: feeMajor != null ? feeMajor : null,
        pending_fee_currency: feeMajor != null ? feeCur : null,
        pending_fee_account_id: feeMajor != null ? feeAccountId : null,
      })
      .eq("transfer_id", transferKey)

    if (headerError) {
      if (isTransfersTableMissing(headerError)) {
        // Fee plan on transfer_out is enough until 12-pending-fee.sql is applied.
        return
      }
      throw headerError
    }
  } else if (deferFee && feeMajor != null) {
    throw new Error(
      "This pending transfer has no transfer header—fee on the receiving account cannot be saved."
    )
  }

  if (deferFee) {
    if (feeRowId) {
      const { error } = await supabaseClient
        .from("transactions")
        .delete()
        .eq("transaction_id", feeRowId)
        .eq("user_id", userId)
      if (error) throw error
    }
    return
  }

  if (feeMajor != null) {
    if (!transferKey) {
      throw new Error("Missing transfer id—cannot save fee row.")
    }
    const row = buildTransferFeeRowForTransfer({
      userId,
      transferId: transferKey,
      feeMajor,
      feeCurrency: feeCur,
      feeAccountId,
      date: storedDate,
      notes,
      rateToBase: resolveRateToBase(feeCur, primary, ratesTable),
      status: "pending",
    })
    if (feeRowId) {
      const { error } = await supabaseClient
        .from("transactions")
        .update(row)
        .eq("transaction_id", feeRowId)
        .eq("user_id", userId)
      if (error) throw withTransferFeeSqlHint(error)
    } else {
      const { error } = await supabaseClient.from("transactions").insert(row)
      if (error) throw withTransferFeeSqlHint(error)
    }
    return
  }

  if (feeRowId) {
    const { error } = await supabaseClient
      .from("transactions")
      .delete()
      .eq("transaction_id", feeRowId)
      .eq("user_id", userId)
    if (error) throw error
  }
}

export function buildDeferredFeeRowFromHeader({
  header,
  transferId,
  userId,
  transferOut,
  rateToBase,
}) {
  const pending = pendingFeeFromHeader(header)
  if (!pending) return null
  return buildTransferFeeRowForTransfer({
    userId,
    transferId,
    feeMajor: pending.major,
    feeCurrency: pending.currency,
    feeAccountId: pending.accountId,
    date: transferOut?.date,
    notes: transferOut?.notes,
    rateToBase,
    status: "completed",
  })
}

export function buildDeferredFeeRowFromPlan({
  transferOut,
  transferId,
  userId,
  rateToBase,
}) {
  const plan = parseFeePlanFromSubcategory(transferOut?.subcategory)
  if (!plan?.feeMajor) return null
  const feeAccountId =
    plan.chargedTo === "to"
      ? transferOut?.to_account_id
      : transferOut?.from_account_id
  if (!feeAccountId) return null
  return buildTransferFeeRowForTransfer({
    userId,
    transferId,
    feeMajor: plan.feeMajor,
    feeCurrency: plan.feeCurrency,
    feeAccountId,
    date: transferOut?.date,
    notes: transferOut?.notes,
    rateToBase,
    status: "completed",
  })
}
