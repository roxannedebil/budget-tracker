import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { useChartColors } from "../../hooks/useChartColors"
import { formatMoney } from "../../utils/transactionStats"
import { formatChartTick } from "../../utils/currencySymbol"
import EmptyState from "../EmptyState"
import Icon from "../icons/Icons"

function BudgetVsActualChart({ data, currencyCode = "PHP" }) {
  const colors = useChartColors()
  const chartData = data.filter((d) => d.budget > 0 || d.actual > 0)

  if (chartData.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="target" size={32} />}
        title="No budget data"
        message="Set category limits to compare budget vs actual spending."
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis
          dataKey="category"
          tick={{ fill: colors.text, fontSize: 11 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: colors.text, fontSize: 11 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          tickFormatter={(v) => formatChartTick(v, currencyCode)}
        />
        <Tooltip
          formatter={(value) => formatMoney(value, currencyCode)}
          contentStyle={{
            background: colors.card,
            border: `1px solid ${colors.grid}`,
            borderRadius: 8,
            color: colors.textH,
          }}
        />
        <Legend />
        <Bar dataKey="budget" name="Budget" fill={colors.accent} radius={[4, 4, 0, 0]} />
        <Bar dataKey="actual" name="Actual" fill={colors.expense} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default BudgetVsActualChart
