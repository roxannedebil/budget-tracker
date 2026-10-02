export default function TransferStepperNav({
  step,
  furthestStep = step,
  onStepChange,
}) {
  const steps = [
    { n: 1, label: "Accounts" },
    { n: 2, label: "Amounts" },
    { n: 3, label: "Review" },
  ]

  return (
    <nav className="transfer-stepper form-field-full" aria-label="Transfer steps">
      {steps.map(({ n, label }) => {
        const isActive = step === n
        const isDone = n < step
        const canVisit = n <= furthestStep
        return (
          <button
            key={n}
            type="button"
            className={`transfer-stepper-item${isActive ? " active" : ""}${isDone ? " done" : ""}`}
            onClick={() => {
              if (canVisit && n !== step) onStepChange(n)
            }}
            disabled={!canVisit}
            aria-current={isActive ? "step" : undefined}
          >
            <span className="transfer-stepper-num">{n}</span>
            <span className="transfer-stepper-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
