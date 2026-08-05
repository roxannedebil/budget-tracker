import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { useChartColors } from "../../hooks/useChartColors"
import { colorAt } from "../../utils/chartColors"
import EmptyState from "../EmptyState"
import CategoryBreakdownTooltip from "./CategoryBreakdownTooltip"

function HorizontalCategoryBarChart({ data }) {
  const colors = useChartColors()
  const chartData = [...data]
    .sort((a, b) => b.total - a.total)
    .map((d) => ({
      name: d.category,
      amount: d.total,
      subcategories: d.subcategories ?? [],
    }))

  if (chartData.length === 0) {
    return (
      <EmptyState
        icon="📊"
        title="No categories"
        message="Top categories will rank your highest spending."
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 36)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: colors.text, fontSize: 11 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          tickFormatter={(v) => `₱${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fill: colors.textH, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={(props) => (
            <CategoryBreakdownTooltip {...props} colors={colors} />
          )}
        />
        <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={18}>
          {chartData.map((entry, i) => (
            <Cell key={entry.name} fill={colorAt(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export default HorizontalCategoryBarChart
