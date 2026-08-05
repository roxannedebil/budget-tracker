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
import EmptyState from "../EmptyState"
import CategoryBreakdownTooltip from "./CategoryBreakdownTooltip"

function CategoryPieChart({ data, emptyTitle = "No data", emptyMessage }) {
  const colors = useChartColors()
  const chartData = data
    .filter((d) => (d.total ?? d.amount) > 0)
    .map((d) => ({
      category: d.category,
      amount: d.total ?? d.amount,
      subcategories: d.subcategories ?? [],
    }))

  if (chartData.length === 0) {
    return (
      <EmptyState icon="🥧" title={emptyTitle} message={emptyMessage} />
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
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {chartData.map((entry, i) => (
            <Cell key={entry.category} fill={colorAt(i)} />
          ))}
        </Pie>
        <Tooltip
          content={(props) => (
            <CategoryBreakdownTooltip {...props} colors={colors} />
          )}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default CategoryPieChart
