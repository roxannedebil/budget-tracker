import { formatMoney } from "../../utils/transactionStats"

function CategoryBreakdownTooltip({ active, payload, label, colors }) {
  if (!active || !payload?.length) return null

  const entry = payload[0].payload
  const name = entry.category ?? entry.name ?? label
  const amount = entry.amount ?? entry.total ?? payload[0].value
  const subcategories = entry.subcategories || []

  return (
    <div
      className="category-breakdown-tooltip"
      style={{
        background: colors.card,
        border: `1px solid ${colors.grid}`,
        borderRadius: 8,
        color: colors.textH,
        padding: "10px 12px",
        fontSize: 13,
        minWidth: 140,
      }}
    >
      <div className="category-breakdown-tooltip-title">{name}</div>
      <div className="category-breakdown-tooltip-total">{formatMoney(amount)}</div>
      {subcategories.length > 0 && (
        <ul className="category-breakdown-tooltip-subs">
          {subcategories.map((sub) => (
            <li key={sub.subcategory}>
              <span>{sub.subcategory}</span>
              <span>{formatMoney(sub.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CategoryBreakdownTooltip
