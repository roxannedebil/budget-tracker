import { useEffect, useRef, useState } from "react"
import { supabase } from "../supabaseClient"
import UserAvatar from "../components/UserAvatar"
import { validateEmail, validateName } from "../utils/authValidation"
import {
  getAvatarUrl,
  getDisplayName,
  uploadAvatar,
  validateAvatarFile,
  formatProfileError,
} from "../utils/profile"
import { formatDisplayDate } from "../utils/formatDate"

function Profile({ session, profile, onProfileUpdate }) {
  const fileInputRef = useRef(null)
  const user = session.user
  const displayName = getDisplayName(profile, user)
  const avatarUrl = getAvatarUrl(profile, user)
  const memberSince = profile?.created_at || user.created_at

  const [fullName, setFullName] = useState(
    profile?.full_name || user.user_metadata?.full_name || ""
  )
  const [newEmail, setNewEmail] = useState("")
  const [nameMessage, setNameMessage] = useState("")
  const [emailMessage, setEmailMessage] = useState("")
  const [passwordMessage, setPasswordMessage] = useState("")
  const [avatarMessage, setAvatarMessage] = useState("")
  const [nameSaving, setNameSaving] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [passwordSending, setPasswordSending] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name || user.user_metadata?.full_name || "")
  }, [profile?.full_name, user.user_metadata?.full_name])

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    setAvatarMessage("")

    const fileError = validateAvatarFile(file)
    if (fileError) {
      setAvatarMessage(fileError)
      return
    }

    setAvatarUploading(true)

    try {
      const publicUrl = await uploadAvatar(supabase, user.id, file)

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) throw profileError

      const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })

      if (metaError) throw metaError

      setAvatarMessage("Profile photo updated.")
      onProfileUpdate?.()
    } catch (err) {
      setAvatarMessage(formatProfileError(err))
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarMessage("")
    setAvatarUploading(true)

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (profileError) throw profileError

      const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: null },
      })

      if (metaError) throw metaError

      setAvatarMessage("Profile photo removed.")
      onProfileUpdate?.()
    } catch (err) {
      setAvatarMessage(formatProfileError(err))
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleNameSave = async (e) => {
    e.preventDefault()
    setNameMessage("")

    const nameError = validateName(fullName, { required: true })
    if (nameError) {
      setNameMessage(nameError)
      return
    }

    setNameSaving(true)
    const trimmed = fullName.trim()

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: trimmed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (profileError) {
      setNameSaving(false)
      setNameMessage(profileError.message)
      return
    }

    const { error: metaError } = await supabase.auth.updateUser({
      data: { full_name: trimmed },
    })

    setNameSaving(false)

    if (metaError) {
      setNameMessage(metaError.message)
      return
    }

    setNameMessage("Full name saved.")
    onProfileUpdate?.()
  }

  const handleEmailSave = async (e) => {
    e.preventDefault()
    setEmailMessage("")

    const emailError = validateEmail(newEmail)
    if (emailError) {
      setEmailMessage(emailError)
      return
    }

    if (newEmail.trim().toLowerCase() === user.email?.toLowerCase()) {
      setEmailMessage("That is already your current email.")
      return
    }

    setEmailSaving(true)

    const { error } = await supabase.auth.updateUser({
      email: newEmail.trim(),
    })

    setEmailSaving(false)

    if (error) {
      setEmailMessage(error.message)
      return
    }

    setEmailMessage(
      "Verification email sent. Check your inbox to confirm the new address."
    )
    setNewEmail("")
  }

  const handlePasswordReset = async () => {
    setPasswordMessage("")

    if (!user.email) {
      setPasswordMessage("No email on file for this account.")
      return
    }

    setPasswordSending(true)

    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    })

    setPasswordSending(false)

    if (error) {
      setPasswordMessage(error.message)
      return
    }

    setPasswordMessage(
      `Password reset link sent to ${user.email}. Check your inbox.`
    )
  }

  return (
    <div className="page profile-page module-page">
      <div className="profile-hero card module-card">
        <div className="profile-hero-avatar-wrap">
          <UserAvatar
            src={avatarUrl}
            name={displayName}
            size="xl"
            className="profile-hero-avatar"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            onChange={handleAvatarChange}
          />
          <button
            type="button"
            className="profile-avatar-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            title="Change photo"
          >
            📷
          </button>
        </div>
        <div className="profile-hero-info">
          <h2 className="profile-hero-name">{displayName}</h2>
          <p className="profile-hero-email">{user.email}</p>
          <div className="profile-hero-chips">
            {memberSince && (
              <span className="chip">
                Member since {formatDisplayDate(memberSince)}
              </span>
            )}
            <span className="chip muted-chip">Budget Tracker</span>
          </div>
          <div className="profile-hero-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
            >
              {avatarUploading ? "Uploading…" : "Upload photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                className="btn-ghost"
                onClick={handleRemoveAvatar}
                disabled={avatarUploading}
              >
                Remove photo
              </button>
            )}
          </div>
          {avatarMessage && (
            <p
              className={`inline-alert ${
                avatarMessage.includes("updated") ||
                avatarMessage.includes("removed")
                  ? "success"
                  : "error"
              }`}
            >
              {avatarMessage}
            </p>
          )}
        </div>
      </div>

      <div className="profile-grid profile-grid-enhanced">
        <section className="card profile-section module-card">
          <div className="profile-section-head">
            <span className="profile-section-icon">👤</span>
            <h2>Full name</h2>
          </div>
          <form className="profile-form" onSubmit={handleNameSave} noValidate>
            <label className="auth-field">
              <span>Display name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder="Jane Doe"
              />
            </label>
            {nameMessage && (
              <p
                className={`inline-alert ${
                  nameMessage === "Full name saved." ? "success" : "error"
                }`}
              >
                {nameMessage}
              </p>
            )}
            <button
              type="submit"
              className="auth-submit profile-save-btn"
              disabled={nameSaving}
            >
              {nameSaving ? "Saving…" : "Save name"}
            </button>
          </form>
        </section>

        <section className="card profile-section module-card">
          <div className="profile-section-head">
            <span className="profile-section-icon">✉️</span>
            <h2>Email</h2>
          </div>
          <p className="muted compact-hint">
            Current: <strong>{user.email}</strong>
          </p>
          <form className="profile-form" onSubmit={handleEmailSave} noValidate>
            <label className="auth-field">
              <span>New email</span>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
                placeholder="new@example.com"
              />
            </label>
            {emailMessage && (
              <p
                className={`inline-alert ${
                  emailMessage.includes("sent") ? "success" : "error"
                }`}
              >
                {emailMessage}
              </p>
            )}
            <button
              type="submit"
              className="auth-submit profile-save-btn"
              disabled={emailSaving}
            >
              {emailSaving ? "Sending…" : "Change email"}
            </button>
            <p className="muted compact-hint">
              A verification link will be sent to your new address.
            </p>
          </form>
        </section>

        <section className="card profile-section module-card">
          <div className="profile-section-head">
            <span className="profile-section-icon">🔒</span>
            <h2>Password</h2>
          </div>
          <p className="muted compact-hint">
            Send a reset link to your email to choose a new password.
          </p>
          {passwordMessage && (
            <p
              className={`inline-alert ${
                passwordMessage.includes("sent") ? "success" : "error"
              }`}
            >
              {passwordMessage}
            </p>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={handlePasswordReset}
            disabled={passwordSending}
          >
            {passwordSending ? "Sending…" : "Send password reset email"}
          </button>
        </section>
      </div>
    </div>
  )
}

export default Profile
