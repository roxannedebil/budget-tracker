import { useEffect, useId, useRef, useState } from "react"
import { AppBrandMark } from "../components/AppBrand"
import Icon from "../components/icons/Icons"
import { supabase } from "../supabaseClient"
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirm,
} from "../utils/authValidation"
import {
  clearSupabaseAuthStorage,
  getRememberMePreference,
  setRememberMePreference,
} from "../utils/authStorage"

const AUTH_FEATURES = [
  {
    icon: "wallet",
    title: "Every currency, one place",
    text: "Hold and track money in any currency.",
  },
  {
    icon: "calendar",
    title: "Month by month",
    text: "See your income and spending at a glance.",
  },
  {
    icon: "transfer",
    title: "Transfers made simple",
    text: "Move money between accounts and currencies.",
  },
]

function formatAuthMessage(message, { isLogin } = {}) {
  if (!message) return ""
  const lower = message.toLowerCase()
  if (
    isLogin &&
    (lower.includes("invalid login credentials") ||
      lower.includes("invalid email or password") ||
      lower.includes("invalid credentials"))
  ) {
    return "Wrong email or password. Please try again."
  }
  return message
}

function getPasswordStrengthHint(password) {
  if (!password) return null
  if (password.length < 6) {
    return "Use at least 6 characters — that’s the minimum for your account."
  }
  if (password.length < 8) {
    return "Good start. A longer password is harder to guess."
  }
  return "Nice — that’s a solid length for your password."
}

function AuthField({
  id,
  label,
  error,
  children,
}) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children(errorId)}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

function Auth({ theme, onToggleTheme }) {
  const [mode, setMode] = useState("login")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => getRememberMePreference())
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotSending, setForgotSending] = useState(false)

  const fullNameRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)
  const confirmRef = useRef(null)
  const formAlertRef = useRef(null)

  const formBaseId = useId()
  const isSignUp = mode === "signup"
  const isBusy = submitting || forgotSending

  const heading = forgotMode
    ? "Reset your password"
    : isSignUp
      ? "Create your account"
      : "Welcome back"

  const subtext = forgotMode
    ? "We’ll email you a link to choose a new password."
    : isSignUp
      ? "Start tracking spending across accounts and currencies."
      : "Sign in to pick up where you left off."

  const focusFirstField = () => {
    if (forgotMode) {
      emailRef.current?.focus()
      return
    }
    if (isSignUp) {
      fullNameRef.current?.focus()
      return
    }
    emailRef.current?.focus()
  }

  const focusFirstError = (nextErrors) => {
    const order = forgotMode
      ? ["email"]
      : isSignUp
        ? ["fullName", "email", "password", "confirmPassword"]
        : ["email", "password"]
    const refs = {
      fullName: fullNameRef,
      email: emailRef,
      password: passwordRef,
      confirmPassword: confirmRef,
    }
    for (const key of order) {
      if (nextErrors[key]) {
        refs[key].current?.focus()
        return
      }
    }
  }

  useEffect(() => {
    focusFirstField()
  }, [mode, forgotMode])

  const validateForm = () => {
    const nextErrors = {}

    if (!forgotMode) {
      const nameError = validateName(fullName, { isSignUp })
      if (nameError) nextErrors.fullName = nameError
    }

    const emailError = validateEmail(email)
    if (emailError) nextErrors.email = emailError

    if (!forgotMode) {
      const passwordError = validatePassword(password, { isSignUp })
      if (passwordError) nextErrors.password = passwordError

      if (isSignUp) {
        const confirmError = validatePasswordConfirm(password, confirmPassword)
        if (confirmError) nextErrors.confirmPassword = confirmError
      }
    }

    setErrors(nextErrors)
    return nextErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage("")

    const validationErrors = validateForm()
    if (Object.keys(validationErrors).length > 0) {
      focusFirstError(validationErrors)
      return
    }

    if (forgotMode) {
      setForgotSending(true)

      const redirectTo = window.location.origin + window.location.pathname
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })

      setForgotSending(false)

      if (error) {
        setMessage(error.message)
        formAlertRef.current?.focus()
        return
      }

      setMessage(`Password reset link sent to ${email.trim()}. Check your inbox.`)
      setForgotMode(false)
      formAlertRef.current?.focus()
      return
    }

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
        formAlertRef.current?.focus()
        return
      }

      setMessage(
        "Account created! Check your email to confirm your account, then log in."
      )
      setMode("login")
      setPassword("")
      setConfirmPassword("")
      formAlertRef.current?.focus()
      return
    }

    setRememberMePreference(rememberMe)
    clearSupabaseAuthStorage()

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setSubmitting(false)

    if (error) {
      setMessage(error.message)
      formAlertRef.current?.focus()
    }
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setErrors({})
    setMessage("")
    setPassword("")
    setConfirmPassword("")
    setShowPassword(false)
    setForgotMode(false)
  }

  const displayMessage = formatAuthMessage(message, { isLogin: mode === "login" && !forgotMode })
  const messageIsSuccess =
    message.includes("sent") || message.includes("created") || message.includes("Check your email")

  const passwordHint = isSignUp && !forgotMode ? getPasswordStrengthHint(password) : null

  const submitLabel = forgotSending
    ? "Sending…"
    : forgotMode
      ? "Send reset link"
      : submitting
        ? isSignUp
          ? "Creating account…"
          : "Signing in…"
        : isSignUp
          ? "Create account"
          : "Log in"

  return (
    <div className="auth-page">
      <div className="auth-page-bg" aria-hidden="true">
        <div className="auth-page-bg-orb auth-page-bg-orb-a" />
        <div className="auth-page-bg-orb auth-page-bg-orb-b" />
      </div>

      <button
        type="button"
        className="auth-theme-btn"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
      </button>

      <div className="auth-shell">
        <aside className="auth-panel" aria-hidden="true">
          <div className="auth-panel-inner">
            <div className="auth-panel-brand">
              <AppBrandMark size={48} />
              <span className="auth-panel-name">KoiNest</span>
            </div>
            <p className="auth-panel-tagline">Your money, all in one nest.</p>
            <ul className="auth-panel-features">
              {AUTH_FEATURES.map((f) => (
                <li key={f.title}>
                  <span className="auth-panel-feature-icon">
                    <Icon name={f.icon} size={20} />
                  </span>
                  <span>
                    <strong>{f.title}</strong>
                    <span className="auth-panel-feature-text">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="auth-panel-motif" aria-hidden="true">
              <svg viewBox="0 0 120 80" className="auth-koi-svg">
                <ellipse cx="60" cy="42" rx="48" ry="22" fill="currentColor" opacity="0.08" />
                <path
                  d="M18 42c20-14 44-14 64 0-12 8-28 12-44 10-8-1-14-4-20-10z"
                  fill="currentColor"
                  opacity="0.12"
                />
              </svg>
            </div>
          </div>
        </aside>

        <div className="auth-main">
          <div className="auth-mobile-brand">
            <AppBrandMark size={40} />
            <span>KoiNest</span>
          </div>

          <div className="auth-card">
            <header className="auth-card-header">
              <h1 id={`${formBaseId}-title`} className="auth-title">
                {heading}
              </h1>
              <p className="auth-subtext">{subtext}</p>
            </header>

            <form
              className="auth-form"
              onSubmit={handleSubmit}
              noValidate
              aria-labelledby={`${formBaseId}-title`}
            >
              {isSignUp && !forgotMode && (
                <AuthField id={`${formBaseId}-name`} label="Full name" error={errors.fullName}>
                  {(describedBy) => (
                    <input
                      ref={fullNameRef}
                      id={`${formBaseId}-name`}
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      inputMode="text"
                      aria-invalid={Boolean(errors.fullName)}
                      aria-describedby={describedBy}
                    />
                  )}
                </AuthField>
              )}

              <AuthField id={`${formBaseId}-email`} label="Email" error={errors.email}>
                {(describedBy) => (
                  <input
                    ref={emailRef}
                    id={`${formBaseId}-email`}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={describedBy}
                  />
                )}
              </AuthField>

              {!forgotMode && (
                <AuthField id={`${formBaseId}-password`} label="Password" error={errors.password}>
                  {(describedBy) => (
                    <>
                      <div className="auth-password-input">
                        <input
                          ref={passwordRef}
                          id={`${formBaseId}-password`}
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={isSignUp ? "new-password" : "current-password"}
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={
                            [describedBy, passwordHint ? `${formBaseId}-pw-hint` : null]
                              .filter(Boolean)
                              .join(" ") || undefined
                          }
                        />
                        <button
                          type="button"
                          className="auth-password-toggle"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                        >
                          <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
                        </button>
                      </div>
                      {passwordHint && (
                        <p id={`${formBaseId}-pw-hint`} className="auth-field-hint">
                          {passwordHint}
                        </p>
                      )}
                    </>
                  )}
                </AuthField>
              )}

              {isSignUp && !forgotMode && (
                <AuthField
                  id={`${formBaseId}-confirm`}
                  label="Confirm password"
                  error={errors.confirmPassword}
                >
                  {(describedBy) => (
                    <div className="auth-password-input">
                      <input
                        ref={confirmRef}
                        id={`${formBaseId}-confirm`}
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={describedBy}
                      />
                      <button
                        type="button"
                        className="auth-password-toggle"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                      >
                        <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
                      </button>
                    </div>
                  )}
                </AuthField>
              )}

              {mode === "login" && !forgotMode && (
                <div className="auth-login-options">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
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
                </div>
              )}

              {forgotMode && (
                <button
                  type="button"
                  className="auth-link-btn auth-back-link"
                  onClick={() => {
                    setForgotMode(false)
                    setMessage("")
                  }}
                >
                  Back to log in
                </button>
              )}

              {displayMessage && (
                <p
                  ref={formAlertRef}
                  tabIndex={-1}
                  className={`auth-message ${messageIsSuccess ? "success" : "error"}`}
                  role={messageIsSuccess ? "status" : "alert"}
                  aria-live="polite"
                >
                  {displayMessage}
                </p>
              )}

              <button type="submit" className="auth-submit" disabled={isBusy}>
                {isBusy && <span className="auth-btn-spinner" aria-hidden="true" />}
                <span>{submitLabel}</span>
              </button>
            </form>

            {!forgotMode && (
              <p className="auth-switch">
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button type="button" onClick={() => switchMode("login")}>
                      Log in
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{" "}
                    <button type="button" onClick={() => switchMode("signup")}>
                      Sign up
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Auth
