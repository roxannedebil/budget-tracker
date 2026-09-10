import AddTransaction from "../components/AddTransaction"
import ImportTransactions from "../components/ImportTransactions"
import TransactionList from "../components/TransactionList"
import StatCard from "../components/StatCard"
import Icon from "../components/icons/Icons"
import {
  formatMoney,
  getBalance,
  getExpenses,
  getIncome,
  getTransfers,
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
  const transfers = getTransfers(transactions)

  const refresh = () => {
    fetchTransactions()
    fetchAccounts()
  }

  return (
    <div className="page transactions-page module-page">
      <div className="stat-grid stat-grid-4 kpi-grid">
        <StatCard
          icon={<Icon name="balance" size={20} />}
          label="Current balance"
          value={formatMoney(getBalance(transactions))}
          variant="balance"
        />
        <StatCard
          icon={<Icon name="income" size={20} />}
          label="Income"
          value={formatMoney(income)}
          variant="income"
        />
        <StatCard
          icon={<Icon name="expense" size={20} />}
          label="Expenses"
          value={formatMoney(expenses)}
          variant="expense"
        />
        <StatCard
          icon={<Icon name="transfer" size={20} />}
          label="Transfers"
          value={formatMoney(transfers)}
          variant="transfer"
        />
      </div>

      <div className="import-excel-section">
        <ImportTransactions accounts={accounts} onImport={refresh} />
      </div>

      <AddTransaction
        accounts={accounts}
        transactions={transactions}
        onAdd={refresh}
      />

      <TransactionList
        transactions={transactions}
        accounts={accounts}
        onUpdated={refresh}
      />
    </div>
  )
}

export default Transactions
