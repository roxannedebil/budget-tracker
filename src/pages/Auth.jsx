import { useState } from "react"
import { supabase } from "../supabaseClient"
import {
  validateEmail,
  validateName,
  validatePassword,
} from "../utils/authValidation"

function Auth({ theme, onToggleTheme }) {
  const [mode, setMode] = useState("login")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSending, setForgotSending] = useState(false)

  const isSignUp = mode === "signup"

  const validateForm = () => {
    const nextErrors = {}

    const nameError = validateName(fullName, { isSignUp })
    if (nameError) nextErrors.fullName = nameError

    const emailError = validateEmail(email)
    if (emailError) nextErrors.email = emailError

    const passwordError = validatePassword(password, { isSignUp })
    if (passwordError) nextErrors.password = passwordError

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage("")

    if (!validateForm()) return

    setSubmitting(true)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      })

      setSubmitting(false)

      if (error) {
        setMessage(error.message)
        return
      }

      setMessage(
        "Account created! Check your email to confirm your account, then log in."
      )
      setMode("login")
      setPassword("")
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setErrors({})
    setMessage("")
    setPassword("")
    setForgotMode(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setMessage("")

    const emailError = validateEmail(email)
    if (emailError) {
      setErrors({ email: emailError })
      return
    }

    setForgotSending(true)

    const redirectTo = window.location.origin + window.location.pathname
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })

    setForgotSending(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(`Password reset link sent to ${email.trim()}. Check your inbox.`)
    setForgotMode(false)
  }

  return (
    <div className="auth-page">
      <button
        type="button"
        className="auth-theme-btn"
        onClick={onToggleTheme}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">💰</span>
          <h1>Budget Tracker</h1>
          <p>
            {isSignUp
              ? "Create an account to start tracking"
              : "Welcome back — sign in to continue"}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => switchMode("signup")}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={forgotMode ? handleForgotPassword : handleSubmit} noValidate>
          {isSignUp && !forgotMode && (
            <label className="auth-field">
              <span>Full name</span>
              <input
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              {errors.fullName && (
                <span className="field-error">{errors.fullName}</span>
              )}
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            {errors.email && (
              <span className="field-error">{errors.email}</span>
            )}
          </label>

          {!forgotMode && (
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                placeholder={isSignUp ? "At least 6 characters" : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
              {errors.password && (
                <span className="field-error">{errors.password}</span>
              )}
            </label>
          )}

          {mode === "login" && !forgotMode && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => {
                setForgotMode(true)
                setMessage("")
                setErrors({})
              }}
            >
              Forgot password?
            </button>
          )}

          {forgotMode && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => {
                setForgotMode(false)
                setMessage("")
              }}
            >
              Back to log in
            </button>
          )}

          {message && (
            <p className={`auth-message ${message.includes("sent") || message.includes("created") ? "success" : "error"}`}>
              {message}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={submitting || forgotSending}>
            {forgotSending
              ? "Sending…"
              : forgotMode
                ? "Send reset link"
                : submitting
                  ? "Please wait…"
                  : isSignUp
                    ? "Create account"
                    : "Log in"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Auth
