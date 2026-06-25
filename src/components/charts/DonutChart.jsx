import { colorAt } from "../../utils/chartColors"

function DonutChart({
  data,
  size = 200,
  centerLabel,
  centerValue,
  emptyMessage = "No data yet",
}) {
  const items = data.filter((d) => d.value > 0)
  const total = items.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return <p className="chart-empty muted">{emptyMessage}</p>
  }

  const radius = 40
  const stroke = 14
  const circumference = 2 * Math.PI * radius
  let offset = 0

  return (
    <div className="donut-chart-wrap">
      <svg
        className="donut-chart"
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={centerLabel || "Chart"}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="var(--chart-track)"
          strokeWidth={stroke}
        />
        {items.map((item, i) => {
          const fraction = item.value / total
          const dash = fraction * circumference
          const color = item.color || colorAt(i)
          const segment = (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              strokeLinecap="butt"
            />
          )
          offset += dash
          return segment
        })}
        {(centerLabel || centerValue) && (
          <text
            x="50"
            y={centerValue ? "46" : "50"}
            textAnchor="middle"
            dominantBaseline="middle"
            className="donut-center-value"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x="50"
            y="58"
            textAnchor="middle"
            dominantBaseline="middle"
            className="donut-center-label"
          >
            {centerLabel}
          </text>
        )}
      </svg>

      <ul className="chart-legend">
        {items.map((item, i) => (
          <li key={item.label}>
            <span
              className="chart-legend-swatch"
              style={{ background: item.color || colorAt(i) }}
            />
            <span className="chart-legend-label">{item.label}</span>
            <span className="chart-legend-value">
              {((item.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DonutChart
