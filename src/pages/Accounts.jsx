import { useEffect, useMemo, useState } from "react"
import AccountHistoryPanel from "../components/AccountHistoryPanel"
import {
  AddAccountModal,
  DeleteAccountModal,
  EditAccountModal,
} from "../components/ManageAccounts"
import StatCard from "../components/StatCard"
import Icon from "../components/icons/Icons"
import { supabase } from "../supabaseClient"
import { getAccountIcon, getAccountTypeLabel } from "../utils/accounts"
import { accountColorStyleVars } from "../utils/accountColor"
import { AccountColorDot } from "../components/AccountLabel"
import {
  getAccountActivity,
  getTransactionsForAccount,
} from "../utils/accountStats"
import { isAccountInUse } from "../utils/accountUsage"
import AccountBalanceLines from "../components/AccountBalanceLines"
import CurrencyTotalsLines from "../components/CurrencyTotalsLines"
import {
  summarizeBalancesByCurrency,
  summarizeByCurrency,
} from "../utils/monthByCurrency"
function Accounts({
  accounts,
  transactions,
  profile,
  fetchAccounts,
  onTransactionsUpdated,
  loading,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [accountError, setAccountError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const activity = useMemo(
    () => getAccountActivity(accounts, transactions),
    [accounts, transactions]
  )

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedId(null)
      return
    }
    const stillExists = accounts.some((a) => a.account_id === selectedId)
    if (!selectedId || !stillExists) {
      setSelectedId(accounts[0].account_id)
    }
  }, [accounts, selectedId])

  const totalsByCurrency = useMemo(
    () => summarizeByCurrency(transactions),
    [transactions]
  )
  const balancesByCurrency = useMemo(
    () => summarizeBalancesByCurrency(accounts, transactions),
    [accounts, transactions]
  )

  const selectedAccount =
    activity.find((a) => a.account_id === selectedId) ?? null

  const accountTransactions = useMemo(() => {
    if (!selectedId) return []
    return getTransactionsForAccount(selectedId, transactions).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [selectedId, transactions])

  const deleteAccountPreview = useMemo(() => {
    if (!deleteTarget) return null
    return (
      activity.find((a) => a.account_id === deleteTarget.account_id) ??
      deleteTarget
    )
  }, [deleteTarget, activity])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const id = deleteTarget.account_id

    if (isAccountInUse(id, transactions)) {
      setDeleteError("This account has transactions and cannot be deleted.")
      return
    }

    setDeleteLoading(true)
    setDeleteError("")

    const { error } = await supabase.from("accounts").delete().eq("account_id", id)
    setDeleteLoading(false)

    if (error) {
      setDeleteError(error.message)
      return
    }

    setDeleteTarget(null)
    setDeleteError("")
    setEditTarget(null)
    fetchAccounts()
  }

  const renderPickerCard = (account) => {
    const isSelected = selectedId === account.account_id
    const inUse = isAccountInUse(account.account_id, transactions)

    return (
      <li key={account.account_id} className="accounts-picker-item">
        <div
          className={`accounts-picker-card has-account-color ${isSelected ? "selected" : ""}`}
          style={accountColorStyleVars(account)}
        >
          <div className="accounts-picker-card-row">
            <button
              type="button"
              className="accounts-picker-card-select"
              onClick={() => setSelectedId(account.account_id)}
              aria-pressed={isSelected}
            >
              <span className="accounts-picker-card-icon" aria-hidden="true">
                <Icon name={getAccountIcon(account.account_type)} size={18} />
              </span>
              <span className="accounts-picker-card-text">
                <span className="accounts-picker-card-title-row">
                  <span className="accounts-picker-card-name">
                    <AccountColorDot account={account} />
                    {account.name}
                  </span>
                  <AccountBalanceLines
                    account={account}
                    valueClassName="accounts-picker-card-balance"
                  />
                </span>
                <span className="accounts-picker-card-type muted">
                  {getAccountTypeLabel(account.account_type)}
                </span>
              </span>
            </button>
            <div className="accounts-picker-card-actions">
              <button
                type="button"
                className="accounts-picker-menu-trigger"
                title="Edit name and type"
                aria-label={`Edit ${account.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setAccountError("")
                  setEditTarget(account)
                }}
              >
                <Icon name="pencil" size={12} />
              </button>
              {!inUse && (
                <button
                  type="button"
                  className="accounts-picker-menu-trigger accounts-picker-delete-trigger"
                  title="Delete account"
                  aria-label={`Delete ${account.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteError("")
                    setDeleteTarget(account)
                  }}
                >
                  <Icon name="trash" size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="page accounts-page module-page">
      {accounts.length > 0 && (
        <div className="stat-grid stat-grid-4 kpi-grid">
          <StatCard
            icon={<Icon name="bank" size={20} />}
            label="Accounts"
            value={String(accounts.length)}
            variant="balance"
          />
          <StatCard
            icon={<Icon name="income" size={20} />}
            label="Total income"
            value={
              <CurrencyTotalsLines
                rows={totalsByCurrency}
                pick={(r) => r.income}
                stacked
              />
            }
            variant="income"
            hint="Per currency"
          />
          <StatCard
            icon={<Icon name="expense" size={20} />}
            label="Total expenses"
            value={
              <CurrencyTotalsLines
                rows={totalsByCurrency}
                pick={(r) => r.expense}
                stacked
              />
            }
            variant="expense"
            hint="Per currency"
          />
          <StatCard
            icon={<Icon name="balance" size={20} />}
            label="Combined balance"
            value={
              <CurrencyTotalsLines
                rows={balancesByCurrency}
                pick={(r) => r.total}
                stacked
              />
            }
            variant="balance"
            hint="Per currency"
          />
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card module-card accounts-empty-card">
          <div className="accounts-empty-state">
            <span className="accounts-empty-icon" aria-hidden="true">
              <Icon name="bank" size={32} />
            </span>
            <p className="accounts-empty-title">Add an account to get started</p>
            <p className="accounts-empty-hint muted">
              Track balances and full transaction history per bank, E-Wallet, or
              cash account.
            </p>
            <button
              type="button"
              className="btn-sm accounts-btn-compact accounts-empty-cta"
              onClick={() => setAddModalOpen(true)}
            >
              Add account
            </button>
          </div>
        </div>
      ) : (
        <div className="accounts-layout">
          <aside className="card module-card accounts-picker">
            <div className="accounts-picker-head">
              <h2>Your accounts</h2>
              <button
                type="button"
                className="btn-sm accounts-btn-compact accounts-picker-add-btn"
                onClick={() => setAddModalOpen(true)}
              >
                + Add
              </button>
            </div>
            <ul className="accounts-picker-list accounts-scroll">
              {activity.map((account) => renderPickerCard(account))}
            </ul>
          </aside>

          <div className="accounts-main">
            {selectedAccount && (
              <AccountHistoryPanel
                account={selectedAccount}
                transactions={accountTransactions}
                allTransactions={transactions}
                accounts={accounts}
                profile={profile}
                loading={loading}
                onUpdated={onTransactionsUpdated}
              />
            )}
          </div>
        </div>
      )}

      {accountError && (
        <p className="inline-alert error accounts-page-error">{accountError}</p>
      )}

      <AddAccountModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => {
          setAccountError("")
          fetchAccounts()
        }}
      />

      <EditAccountModal
        open={Boolean(editTarget)}
        account={editTarget}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          setAccountError("")
          fetchAccounts()
        }}
      />

      <DeleteAccountModal
        open={Boolean(deleteAccountPreview)}
        account={deleteAccountPreview}
        loading={deleteLoading}
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError("")
        }}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default Accounts
