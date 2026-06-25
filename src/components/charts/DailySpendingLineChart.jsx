import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useChartColors } from "../../hooks/useChartColors"
import { formatMoney } from "../../utils/transactionStats"
import EmptyState from "../EmptyState"

function DailySpendingLineChart({ data }) {
  const colors = useChartColors()
  const hasData = data.some((d) => d.amount > 0)

  if (!hasData) {
    return (
      <EmptyState
        icon="📈"
        title="No daily spending"
        message="Daily trend appears when you log expenses this month."
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.text, fontSize: 11 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: colors.text, fontSize: 11 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          tickFormatter={(v) => `₱${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
        />
        <Tooltip
          formatter={(value) => formatMoney(value)}
          labelFormatter={(label) => `Day ${label}`}
          contentStyle={{
            background: colors.card,
            border: `1px solid ${colors.grid}`,
            borderRadius: 8,
            color: colors.textH,
          }}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke={colors.expense}
          strokeWidth={2.5}
          dot={{ r: 3, fill: colors.expense }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default DailySpendingLineChart
