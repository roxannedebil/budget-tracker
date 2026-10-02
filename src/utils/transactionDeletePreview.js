import {
  getTransferLegs,
  resolveTransferActionTarget,
  shouldDeleteViaTransferRpc,
  getTransferDeleteBalanceEffects,
} from "./transferLifecycle"

const TYPE_SORT = { transfer_out: 0, transfer: 0, fee: 1, transfer_in: 2 }

function sortPreviewRows(rows) {
  return [...rows].sort((a, b) => {
    const dateCmp = String(a.date ?? "").localeCompare(String(b.date ?? ""))
    if (dateCmp !== 0) return dateCmp
    return (TYPE_SORT[a.type] ?? 9) - (TYPE_SORT[b.type] ?? 9)
  })
}

/** Rows that will be removed from the database for this delete action. */
export function getTransactionsForDelete(transaction, allTransactions = []) {
  if (!transaction) return []

  const target =
    resolveTransferActionTarget(transaction, allTransactions) ?? transaction

  if (shouldDeleteViaTransferRpc(target)) {
    const legs = getTransferLegs(target, allTransactions)
    if (legs.length > 0) return sortPreviewRows(legs)
  }

  return [target]
}

/** Balance impact lines after deletion (reversal of each affected row). */
export function getDeleteBalanceImpactLines(affectedRows, accounts) {
  return getTransferDeleteBalanceEffects(affectedRows, accounts)
}
