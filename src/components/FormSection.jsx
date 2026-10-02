/** Visual grouping for long forms (copy/layout only). */
function FormSection({ title, hint, children, className = "" }) {
  return (
    <fieldset className={`form-section ${className}`.trim()}>
      {title ? <legend className="form-section-legend">{title}</legend> : null}
      {hint ? <p className="form-section-hint muted">{hint}</p> : null}
      <div className="form-section-body">{children}</div>
    </fieldset>
  )
}

export function FieldHint({ children, id, className = "" }) {
  if (!children) return null
  return (
    <span className={`form-hint muted ${className}`.trim()} id={id}>
      {children}
    </span>
  )
}

export function InfoTip({ label, text }) {
  return (
    <button
      type="button"
      className="info-tip-btn"
      aria-label={label}
      title={text}
    >
      <span aria-hidden="true">i</span>
    </button>
  )
}

export default FormSection
