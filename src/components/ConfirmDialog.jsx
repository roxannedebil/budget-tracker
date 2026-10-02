import { useEffect } from "react"
import ModalPortal from "./ModalPortal"

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  danger = false,
  error,
}) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <ModalPortal>
      <div
        className="modal-overlay confirm-dialog-overlay"
        role="presentation"
        onClick={loading ? undefined : onCancel}
      >
        <div
          className="modal-card confirm-dialog"
          role="alertdialog"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="confirm-dialog-title">{title}</h2>
          <p id="confirm-dialog-message" className="confirm-dialog-message">
            {message}
          </p>
          <div
            className={`confirm-dialog-error-slot${error ? " has-error" : ""}`}
            aria-live="polite"
          >
            {error ? <p className="inline-alert error">{error}</p> : null}
          </div>
          <div className="confirm-dialog-actions modal-form-actions">
            <button
              type="button"
              className={danger ? "confirm-dialog-danger" : "auth-submit"}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? "Please wait…" : confirmLabel}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

export default ConfirmDialog
