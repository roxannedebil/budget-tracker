import AddTransaction from "../components/AddTransaction"
import ImportTransactions from "../components/ImportTransactions"
import ManageAccounts from "../components/ManageAccounts"
import TransactionList from "../components/TransactionList"
import StatCard from "../components/StatCard"
import { getPayrollIncome } from "../utils/accountStats"
import {
  formatMoney,
  getBalance,
  getExpenses,
  getIncome,
} from "../utils/transactionStats"

function Transactions({
  transactions,
  accounts,
  fetchTransactions,
  fetchAccounts,
  loading,
}) {
  const income = getIncome(transactions)
  const expenses = getExpenses(transactions)
  const payroll = getPayrollIncome(transactions)

  const refresh = () => {
    fetchTransactions()
    fetchAccounts()
  }

  return (
    <div className="page transactions-page module-page">
      <div className="stat-grid stat-grid-4 kpi-grid">
        <StatCard
          icon="💵"
          label="Payroll"
          value={formatMoney(payroll)}
          variant="income"
        />
        <StatCard
          icon="📥"
          label="Income"
          value={formatMoney(income)}
          variant="income"
        />
        <StatCard
          icon="📤"
          label="Expenses"
          value={formatMoney(expenses)}
          variant="expense"
        />
        <StatCard
          icon="⚖️"
          label="Balance"
          value={formatMoney(getBalance(transactions))}
          variant="balance"
        />
      </div>

      <div className="txn-toolbar module-panel">
        <ManageAccounts
          accounts={accounts}
          transactions={transactions}
          onUpdate={fetchAccounts}
        />
        <ImportTransactions accounts={accounts} onImport={refresh} />
      </div>

      <AddTransaction
        accounts={accounts}
        transactions={transactions}
        onAdd={refresh}
      />

      <div className="card module-card section-card">
        <div className="card-header">
          <h2>All transactions</h2>
          {!loading && (
            <span className="chip">{transactions.length} total</span>
          )}
        </div>
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          onUpdated={refresh}
        />
      </div>
    </div>
  )
}

export default Transactions
