import "./App.css"
import { useCallback, useEffect, useState } from "react"
import { supabase } from "./supabaseClient"

import Sidebar from "./components/Sidebar"
import AppTopbar from "./components/AppTopbar"
import ResetPassword from "./components/ResetPassword"
import Auth from "./pages/Auth"

import Dashboard from "./pages/Dashboard"
import Transactions from "./pages/Transactions"
import Budget from "./pages/Budget"
import Reports from "./pages/Reports"
import Profile from "./pages/Profile"

function getInitialTheme() {
  const saved = localStorage.getItem("theme")
  if (saved === "light" || saved === "dark") return saved
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function getInitialSidebarCollapsed() {
  return localStorage.getItem("sidebarCollapsed") === "true"
}

const PAGE_META = {
  dashboard: { title: "Dashboard", subtitle: "This month at a glance" },
  transactions: {
    title: "Transactions",
    subtitle: "Income, expenses & transfers",
  },
  budget: { title: "Budget", subtitle: "Monthly limits by category" },
  reports: { title: "Reports", subtitle: "Charts & breakdowns" },
  profile: { title: "Profile", subtitle: "Account settings" },
}

function App() {
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [profile, setProfile] = useState(null)
  const [activePage, setActivePage] = useState("dashboard")
  const [theme, setTheme] = useState(getInitialTheme)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    getInitialSidebarCollapsed
  )
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [resetNotice, setResetNotice] = useState("")

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    localStorage.setItem("theme", theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()

    if (error) {
      console.error("Profile fetch error:", error.message)
      return
    }

    setProfile(data)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current)
      if (current?.user?.id) {
        fetchProfile(current.user.id)
      }
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, current) => {
      setSession(current)

      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true)
      }

      if (current?.user?.id) {
        fetchProfile(current.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const fetchAccounts = async () => {
    if (!session) return

    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Accounts fetch error:", error.message)
      return
    }

    setAccounts(data || [])
  }

  const fetchTransactions = async () => {
    if (!session) return

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("transaction_id", { ascending: false })

    if (error) {
      console.error("Fetch error:", error.message, error.code, error.details)
      return
    }

    setTransactions(data || [])
  }

  const loadData = async () => {
    if (!session) return
    setDataLoading(true)
    await Promise.all([fetchTransactions(), fetchAccounts()])
    setDataLoading(false)
  }

  useEffect(() => {
    if (session) {
      loadData()
    } else {
      setTransactions([])
      setAccounts([])
      setDataLoading(false)
    }
  }, [session])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setActivePage("dashboard")
    setPasswordRecovery(false)
  }

  if (authLoading) {
    return <div className="auth-loading">Loading…</div>
  }

  if (!session) {
    return (
      <Auth
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => (t === "dark" ? "light" : "dark"))
        }
      />
    )
  }

  return (
    <div className={`app-layout ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        session={session}
        profile={profile}
        onLogout={handleLogout}
      />

      <div className="content">
        <AppTopbar
          title={PAGE_META[activePage]?.title ?? "Budget Tracker"}
          subtitle={PAGE_META[activePage]?.subtitle}
          theme={theme}
          onToggleTheme={() =>
            setTheme((t) => (t === "dark" ? "light" : "dark"))
          }
        />

        {resetNotice && (
          <p className="inline-alert success content-notice">{resetNotice}</p>
        )}

        {activePage === "dashboard" && (
          <Dashboard
            transactions={transactions}
            loading={dataLoading}
          />
        )}

        {activePage === "transactions" && (
          <Transactions
            transactions={transactions}
            accounts={accounts}
            fetchTransactions={fetchTransactions}
            fetchAccounts={fetchAccounts}
            loading={dataLoading}
          />
        )}

        {activePage === "budget" && (
          <Budget transactions={transactions} loading={dataLoading} />
        )}

        {activePage === "reports" && (
          <Reports transactions={transactions} loading={dataLoading} />
        )}

        {activePage === "profile" && (
          <Profile
            session={session}
            profile={profile}
            onProfileUpdate={() => fetchProfile(session.user.id)}
          />
        )}
      </div>

      {passwordRecovery && (
        <ResetPassword
          onClose={() => setPasswordRecovery(false)}
          onSuccess={() =>
            setResetNotice("Password updated successfully.")
          }
        />
      )}
    </div>
  )
}

export default App
