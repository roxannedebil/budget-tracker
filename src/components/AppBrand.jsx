const LOGO_SRC = `${import.meta.env.BASE_URL}koinest-logo.svg`

/** App logo — shared in sidebar, auth, etc. */
export function AppBrandMark({ size = 32, className = "" }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      width={size}
      height={size}
      className={`app-brand-mark ${className}`.trim()}
      decoding="async"
      draggable={false}
    />
  )
}

export function AppBrand({ collapsed = false, className = "" }) {
  if (collapsed) {
    return (
      <div className={`app-brand app-brand-collapsed ${className}`.trim()}>
        <AppBrandMark size={28} />
      </div>
    )
  }

  return (
    <div className={`app-brand ${className}`.trim()}>
      <AppBrandMark size={32} />
      <span className="app-brand-name">KoiNest</span>
    </div>
  )
}

export { LOGO_SRC }
