import { supabase } from "../supabaseClient"
import { signedMinorForType } from "../utils/currency.js"
import {
  getTransferKey,
  isLegacySingleTransfer,
  resolvePendingReceiveCurrency,
  shouldDeleteViaTransferRpc,
} from "../utils/transferLifecycle.js"
import {
  buildDeferredFeeRowFromHeader,
  buildDeferredFeeRowFromPlan,
} from "../utils/transferFee.js"
import { resolveRateToBase } from "../utils/transactionPayload.js"

async function deleteTransferGroupClient(userId, transaction) {
  const id = transaction?.transaction_id ?? transaction?.id
  const transferKey = getTransferKey(transaction)

  if (isLegacySingleTransfer(transaction)) {
    return supabase
      .from("transactions")
      .delete()
      .eq("transaction_id", id)
      .eq("user_id", userId)
  }

  if (!transferKey) {
    return {
      data: null,
      error: { message: "This transfer is not linked to a group and cannot be removed." },
    }
  }

  const removed = await supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .or(`transfer_id.eq.${transferKey},transfer_group_id.eq.${transferKey}`)

  if (removed.error) return removed

  const header = await supabase
    .from("transfers")
    .delete()
    .eq("transfer_id", transferKey)
    .eq("user_id", userId)

  if (
    header.error &&
    !/transfers|schema cache|does not exist/i.test(header.error.message || "")
  ) {
    return header
  }

  return removed
}

/** Delete one row or a whole transfer group (no RPC required). */
export async function deleteTransaction(transaction) {
  const id = transaction?.transaction_id ?? transaction?.id
  if (id == null || id === "") {
    return { data: null, error: { message: "Could not identify this transaction." } }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { data: null, error: { message: "Not authenticated." } }
  }

  if (shouldDeleteViaTransferRpc(transaction)) {
    return deleteTransferGroupClient(user.id, transaction)
  }

  return supabase
    .from("transactions")
    .delete()
    .eq("transaction_id", id)
    .eq("user_id", user.id)
}

export async function rpcDeleteTransfer(transactionId) {
  return supabase.rpc("delete_transfer", {
    p_transaction_id: transactionId,
  })
}

function isMissingRpcError(error) {
  const msg = error?.message || ""
  return (
    msg.includes("schema cache") ||
    msg.includes("Could not find the function")
  )
}

function isTransfersTableMissing(error) {
  const msg = error?.message || ""
  return (
    /relation\s+"?public\.transfers"?\s+does not exist/i.test(msg) ||
    /relation\s+"?transfers"?\s+does not exist/i.test(msg) ||
    (/transfers/i.test(msg) && /does not exist|schema cache/i.test(msg))
  )
}

function withTransferFeeSqlHint(error) {
  if (!error?.message) return error
  const msg = error.message
  if (
    /fee|transactions_type_check|type check|violates check constraint/i.test(msg)
  ) {
    return {
      ...error,
      message: `${msg} Run supabase/multi-currency/11-transfer-fee.sql in the Supabase SQL Editor (adds the fee type).`,
    }
  }
  return error
}

async function createTransferBundleClient({ header, transactions }) {
  if (header) {
    const { error: headerError } = await supabase.from("transfers").insert(header)
    const deferredFeeOnHeader =
      header.pending_fee_major != null && Number(header.pending_fee_major) > 0
    if (headerError && !isTransfersTableMissing(headerError)) {
      return { data: null, error: headerError }
    }
    if (headerError && isTransfersTableMissing(headerError) && deferredFeeOnHeader) {
      return {
        data: null,
        error: {
          message:
            "Transfer fee was not saved—the transfers table is missing pending fee columns. Run supabase/multi-currency/12-pending-fee.sql in Supabase SQL Editor, then create the transfer again.",
        },
      }
    }
    // No transfers table: legs still share transfer_id / transfer_group_id on rows.
  }

  if (!transactions?.length) {
    return { data: null, error: { message: "No transaction rows provided." } }
  }

  const inserted = await supabase.from("transactions").insert(transactions)
  if (inserted.error) {
    return { ...inserted, error: withTransferFeeSqlHint(inserted.error) }
  }
  return inserted
}

/** Atomic bundle when RPC exists; otherwise header + rows insert (no RPC required). */
export async function createTransferBundle(payload) {
  const rpc = await supabase.rpc("create_transfer_bundle", {
    p_header: payload.header,
    p_transactions: payload.transactions,
  })
  if (!rpc.error) return rpc
  if (isMissingRpcError(rpc.error) || isTransfersTableMissing(rpc.error)) {
    return createTransferBundleClient(payload)
  }
  return { ...rpc, error: withTransferFeeSqlHint(rpc.error) }
}

export async function rpcCreateTransferBundle({ header, transactions }) {
  return supabase.rpc("create_transfer_bundle", {
    p_header: header,
    p_transactions: transactions,
  })
}

async function completePendingTransferClient({
  transferId,
  receiveMajor,
  receiveMinor,
  effectiveRate,
  rateToBaseReceive,
  transferOut,
  transferHeader,
  toAccount,
  primary,
  ratesTable,
  userId,
}) {
  if (!transferOut || !transferId) {
    return { data: null, error: { message: "Pending transfer leg not found." } }
  }

  const recvCur = resolvePendingReceiveCurrency({
    transferHeader,
    transferOut,
    toAccount,
    primary,
  })
  const groupId = transferOut.transfer_group_id || transferId

  const transferIn = {
    user_id: userId,
    type: "transfer_in",
    amount: Number(receiveMajor),
    amount_minor: receiveMinor,
    currency: recvCur,
    rate_to_base: rateToBaseReceive,
    category: "Transfer in",
    subcategory: null,
    notes: transferOut.notes || null,
    date: transferOut.date,
    status: "completed",
    from_account_id: null,
    to_account_id: transferHeader?.to_account_id || transferOut.to_account_id,
    transfer_group_id: groupId,
    transfer_id: transferId,
    received_amount_minor: receiveMinor,
    market_rate_estimate: transferOut.market_rate_estimate ?? null,
    effective_rate: effectiveRate,
    income_source: null,
  }

  const toInsert = [transferIn]
  const { data: existingFeeLegs, error: feeLookupError } = await supabase
    .from("transactions")
    .select("transaction_id")
    .eq("user_id", userId)
    .eq("transfer_id", transferId)
    .eq("type", "fee")
    .limit(1)
  if (feeLookupError) return { data: null, error: feeLookupError }

  const feeRateToBase = resolveRateToBase(
    transferHeader?.pending_fee_currency || recvCur,
    primary,
    ratesTable
  )
  const deferredFee =
    !existingFeeLegs?.length &&
    (buildDeferredFeeRowFromHeader({
      header: transferHeader,
      transferId,
      userId,
      transferOut,
      rateToBase: feeRateToBase,
    }) ||
      buildDeferredFeeRowFromPlan({
        transferOut,
        transferId,
        userId,
        rateToBase: feeRateToBase,
      }))
  if (deferredFee) toInsert.push(deferredFee)

  const { error: insertError } = await supabase.from("transactions").insert(toInsert)
  if (insertError) return { data: null, error: insertError }

  const outId = transferOut.transaction_id ?? transferOut.id
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      status: "completed",
      effective_rate: effectiveRate,
      received_amount_minor: receiveMinor,
    })
    .eq("transaction_id", outId)
    .eq("user_id", userId)

  if (updateError) return { data: null, error: updateError }

  if (transferHeader?.transfer_id) {
    await supabase
      .from("transfers")
      .update({
        status: "completed",
        pending_fee_major: null,
        pending_fee_currency: null,
        pending_fee_account_id: null,
      })
      .eq("transfer_id", transferId)
      .eq("user_id", userId)
  }

  return { data: null, error: null }
}

export async function completePendingTransfer({
  transferId,
  receiveMajor,
  receiveMinor,
  effectiveRate,
  rateToBaseReceive,
  transferOut,
  transferHeader,
  toAccount,
  primary,
  ratesTable = null,
}) {
  const major = Number(receiveMajor)
  if (!Number.isFinite(major) || major <= 0) {
    return {
      data: null,
      error: {
        message:
          "Receive amount is missing or invalid. Open Amounts (step 2) and confirm what you expect to receive.",
      },
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { data: null, error: { message: "Not authenticated." } }
  }

  const rpc = await supabase.rpc("complete_pending_transfer", {
    p_transfer_id: transferId,
    p_receive_major: major,
    p_receive_minor: receiveMinor,
    p_effective_rate: effectiveRate,
    p_rate_to_base_receive: rateToBaseReceive,
  })

  if (!rpc.error) return rpc

  if (
    isMissingRpcError(rpc.error) ||
    isTransfersTableMissing(rpc.error) ||
    /Transfer not found|complete_pending_transfer/i.test(rpc.error.message || "")
  ) {
    return completePendingTransferClient({
      transferId,
      receiveMajor: major,
      receiveMinor,
      effectiveRate,
      rateToBaseReceive,
      transferOut,
      transferHeader,
      toAccount,
      primary,
      ratesTable,
      userId: user.id,
    })
  }

  return rpc
}

export async function rpcCompletePendingTransfer(params) {
  return completePendingTransfer(params)
}
