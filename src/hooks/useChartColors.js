import { useEffect, useState } from "react"

function readColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    income: s.getPropertyValue("--income-text").trim() || "#22c55e",
    expense: s.getPropertyValue("--expense-text").trim() || "#ef4444",
    accent: s.getPropertyValue("--accent").trim() || "#3b82f6",
    transfer: s.getPropertyValue("--transfer-text").trim() || "#2563eb",
    text: s.getPropertyValue("--text").trim() || "#64748b",
    textH: s.getPropertyValue("--text-h").trim() || "#0f172a",
    grid: s.getPropertyValue("--border").trim() || "#e2e8f0",
    card: s.getPropertyValue("--bg-card").trim() || "#ffffff",
  }
}

export function useChartColors() {
  const [colors, setColors] = useState(readColors)

  useEffect(() => {
    const update = () => setColors(readColors())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })
    return () => observer.disconnect()
  }, [])

  return colors
}
