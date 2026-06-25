import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useChartColors } from "../../hooks/useChartColors"
import { colorAt } from "../../utils/chartColors"
import { formatMoney } from "../../utils/transactionStats"
import EmptyState from "../EmptyState"

function ExpenseDonutChart({ data }) {
  const colors = useChartColors()
  const chartData = data.filter((d) => d.amount > 0)

  if (chartData.length === 0) {
    return (
      <EmptyState
        icon="🍩"
        title="No expenses"
        message="Expense breakdown will appear once you add spending."
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="amount"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={2}
        >
          {chartData.map((entry, i) => (
            <Cell key={entry.category} fill={colorAt(i)} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatMoney(value)}
          contentStyle={{
            background: colors.card,
            border: `1px solid ${colors.grid}`,
            borderRadius: 8,
            color: colors.textH,
          }}
        />
        <Legend
          formatter={(value, entry) => {
            const pct = entry?.payload?.percentage?.toFixed?.(0) ?? 0
            return `${value} (${pct}%)`
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default ExpenseDonutChart
