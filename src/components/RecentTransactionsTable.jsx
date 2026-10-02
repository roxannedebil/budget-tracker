import {
  getTransactionCategoryCell,
  getTypeAmountClass,
  getTypePillClass,
  getTypeLabel,
  getNotesWithFeeContext,
} from "../utils/transactionDisplay"
import { formatDisplayDate } from "../utils/formatDate"
import { formatTransactionAmount } from "../utils/currency"
import { AccountsCell } from "./AccountLabel"
import EmptyState from "./EmptyState"
import Icon from "./icons/Icons"
import { useTransactionRowActions } from "../hooks/useTransactionRowActions"
import TransactionRowActions from "./TransactionRowActions"

function RecentTransactionsTable({
  transactions,
  allTransactions,
  accounts = [],
  profile,
  limit = 10,
  onUpdated,
}) {
  const corpus = allTransactions ?? transactions

  const { modals: transactionActionModals, getRowActionProps } =
    useTransactionRowActions({
      transactions: corpus,
      accounts,
      profile,
      onUpdated,
    })

  const rows = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)

  if (rows.length === 0) {
    return (
      <>
        <EmptyState
          icon={<Icon name="credit-card" size={32} />}
          title="No transactions yet"
          message="Add your first transaction to show it here."
        />
        {transactionActionModals}
      </>
    )
  }

  return (
    <>
      <div className="table-wrap recent-tx-wrap">
        <table className="report-table recent-tx-table recent-tx-table-with-actions">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Accounts</th>
              <th>Category</th>
              <th>Notes</th>
              <th className="col-amount">Amount</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const category = getTransactionCategoryCell(t, accounts, {
                allTransactions: corpus,
              })
              return (
                <tr key={t.transaction_id ?? t.id}>
                  <td className="recent-tx-date">{formatDisplayDate(t.date)}</td>
                  <td>
                    <span
                      className={`type-pill type-${getTypePillClass(t.type)}`}
                    >
                      {getTypeLabel(t)}
                    </span>
                  </td>
                  <td className="recent-tx-accounts">
                    <AccountsCell
                      t={t}
                      accounts={accounts}
                      allTransactions={corpus}
                    />
                  </td>
                  <td className="recent-tx-category">{category}</td>
                  <td
                    className="recent-tx-notes"
                    title={getNotesWithFeeContext(t, accounts, corpus)}
                  >
                    {getNotesWithFeeContext(t, accounts, corpus)}
                  </td>
                  <td className={`col-amount ${getTypeAmountClass(t.type)}`}>
                    {formatTransactionAmount(t, { signed: true })}
                  </td>
                  <td className="col-actions">
                    <TransactionRowActions
                      {...getRowActionProps(t, category)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {transactionActionModals}
    </>
  )
}

export default RecentTransactionsTable
