import type { AnalyticsMetricId } from "@/lib/analytics/types";

export function formatMetricValue(id: AnalyticsMetricId, value: number): string {
  switch (id) {
    case "estimatedRevenue":
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(
        value
      );
    case "streamLength":
      return formatStreamMinutes(Math.round(value));
    case "averageViewers":
    case "maxViewers":
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1);
    default:
      return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
}

export function formatStreamMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatTooltipValue(id: AnalyticsMetricId, v: number): string {
  return formatMetricValue(id, v);
}

export function formatTrendPct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
