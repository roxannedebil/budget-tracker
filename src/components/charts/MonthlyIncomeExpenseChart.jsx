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

function MonthlyIncomeExpenseChart({ data, currencyCode = "PHP" }) {
  const colors = useChartColors()

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<Icon name="calendar" size={32} />}
        title="No monthly data"
        message="Add transactions to see income vs expenses by month."
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
        <Bar dataKey="income" name="Income" fill={colors.income} radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" name="Expenses" fill={colors.expense} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default MonthlyIncomeExpenseChart
