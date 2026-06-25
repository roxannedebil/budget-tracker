import { useState } from "react"
import { supabase } from "../supabaseClient"
import { validatePassword } from "../utils/authValidation"

function ResetPassword({ onClose, onSuccess }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    const passwordError = validatePassword(password, { isSignUp: true })
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }

    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-labelledby="reset-password-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reset-password-title">Set new password</h2>
        <p className="muted">Choose a new password for your account.</p>

        <form className="profile-form" onSubmit={handleSubmit} noValidate>
          <label className="auth-field">
            <span>New password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
          </label>

          <label className="auth-field">
            <span>Confirm password</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>

          {error && <p className="inline-alert error">{error}</p>}

          <div className="profile-form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? "Saving…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPassword
