import { useEffect, useState } from "react"

function readColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    income: s.getPropertyValue("--income-text").trim() || "#166534",
    expense: s.getPropertyValue("--expense-text").trim() || "#b42318",
    accent: s.getPropertyValue("--accent").trim() || "#4f46e5",
    transfer: s.getPropertyValue("--transfer-text").trim() || "#4338ca",
    text: s.getPropertyValue("--text").trim() || "#3d362e",
    textH: s.getPropertyValue("--text-h").trim() || "#1f1a14",
    grid: s.getPropertyValue("--chart-track").trim() || s.getPropertyValue("--border").trim() || "#d3c8b8",
    card: s.getPropertyValue("--bg-card").trim() || "#fbf8f2",
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
