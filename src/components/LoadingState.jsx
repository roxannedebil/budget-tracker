function LoadingState({ message = "Loading data…" }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <div className="loading-spinner" />
      <p>{message}</p>
    </div>
  )
}

export default LoadingState
