import { useMemo } from "react"
import AddTransaction from "../components/AddTransaction"
import ImportTransactions from "../components/ImportTransactions"
import TransactionList from "../components/TransactionList"
import StatCard from "../components/StatCard"
import CurrencyTotalsLines from "../components/CurrencyTotalsLines"
import Icon from "../components/icons/Icons"
import {
  summarizeByCurrency,
  summarizeTransfersByCurrency,
} from "../utils/monthByCurrency"

function Transactions({
  transactions,
  accounts,
  profile,
  fetchTransactions,
  fetchAccounts,
  loading,
}) {
  const byCurrency = useMemo(
    () => summarizeByCurrency(transactions),
    [transactions]
  )

  const transfersByCurrency = useMemo(
    () => summarizeTransfersByCurrency(transactions),
    [transactions]
  )

  const refresh = () => {
    fetchTransactions()
    fetchAccounts()
  }

  return (
    <div className="page transactions-page module-page">
      <div className="stat-grid stat-grid-4 kpi-grid">
        <StatCard
          icon={<Icon name="balance" size={20} />}
          label="Net (income − expenses)"
          value={
            <CurrencyTotalsLines rows={byCurrency} pick={(r) => r.net} stacked />
          }
          variant="balance"
          hint="Per currency"
        />
        <StatCard
          icon={<Icon name="income" size={20} />}
          label="Income"
          value={
            <CurrencyTotalsLines rows={byCurrency} pick={(r) => r.income} stacked />
          }
          variant="income"
          hint="Per currency"
        />
        <StatCard
          icon={<Icon name="expense" size={20} />}
          label="Expenses"
          value={
            <CurrencyTotalsLines rows={byCurrency} pick={(r) => r.expense} stacked />
          }
          variant="expense"
          hint="Per currency"
        />
        <StatCard
          icon={<Icon name="transfer" size={20} />}
          label="Transfers"
          value={
            <CurrencyTotalsLines
              rows={transfersByCurrency}
              pick={(r) => r.total}
              stacked
            />
          }
          variant="transfer"
          hint="Send volume per currency"
        />
      </div>

      <div className="import-excel-section">
        <ImportTransactions
          accounts={accounts}
          transactions={transactions}
          onImport={refresh}
        />
      </div>

      <AddTransaction
        accounts={accounts}
        transactions={transactions}
        profile={profile}
        onAdd={refresh}
      />

      <TransactionList
        transactions={transactions}
        accounts={accounts}
        profile={profile}
        onUpdated={refresh}
      />
    </div>
  )
}

export default Transactions
