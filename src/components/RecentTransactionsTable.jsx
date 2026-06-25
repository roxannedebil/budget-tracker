import { formatDisplayDate } from "../utils/formatDate"
import { formatMoney } from "../utils/transactionStats"
import EmptyState from "./EmptyState"

function RecentTransactionsTable({ transactions, limit = 10 }) {
  const rows = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="💳"
        title="No transactions yet"
        message="Add your first transaction to see it here."
      />
    )
  }

  return (
    <div className="table-wrap">
      <table className="report-table recent-tx-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.transaction_id ?? t.id}>
              <td>{formatDisplayDate(t.date)}</td>
              <td>
                <span className={`type-pill type-${t.type}`}>
                  {t.type}
                </span>
              </td>
              <td>{t.category || "—"}</td>
              <td
                className={
                  t.type === "expense"
                    ? "expense-text"
                    : t.type === "income"
                      ? "income-text"
                      : "transfer-text"
                }
              >
                {formatMoney(t.amount)}
              </td>
              <td className="notes-cell">{t.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RecentTransactionsTable
