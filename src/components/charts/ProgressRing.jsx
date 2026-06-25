function ProgressRing({
  value,
  max = 100,
  size = 120,
  label,
  sublabel,
  variant = "accent",
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const radius = 40
  const stroke = 10
  const circumference = 2 * Math.PI * radius
  const dash = (pct / 100) * circumference
  const strokeColor =
    variant === "expense"
      ? "var(--expense-text)"
      : variant === "income"
        ? "var(--income-text)"
        : "var(--accent)"

  return (
    <div className="progress-ring-wrap">
      <svg
        className="progress-ring"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={label}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="var(--chart-track)"
          strokeWidth={stroke}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text
          x="50"
          y={sublabel ? "46" : "50"}
          textAnchor="middle"
          dominantBaseline="middle"
          className="donut-center-value"
        >
          {Math.round(pct)}%
        </text>
        {sublabel && (
          <text
            x="50"
            y="58"
            textAnchor="middle"
            dominantBaseline="middle"
            className="donut-center-label"
          >
            {sublabel}
          </text>
        )}
      </svg>
      {label && <span className="progress-ring-label">{label}</span>}
    </div>
  )
}

export default ProgressRing
