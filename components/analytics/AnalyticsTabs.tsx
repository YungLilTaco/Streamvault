"use client";

import * as React from "react";
import { ChevronsUpDown, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/components/lib/cn";
import type { AnalyticsMetricId, MetricSummary } from "@/lib/analytics/types";
import { METRIC_ORDER } from "@/lib/analytics/types";
import { formatMetricValue, formatTrendPct } from "@/lib/analytics/formatters";

export function AnalyticsTabs({
  summaries,
  active,
  onSelect
}: {
  summaries: Record<AnalyticsMetricId, MetricSummary>;
  active: AnalyticsMetricId;
  onSelect: (id: AnalyticsMetricId) => void;
}) {
  return (
    <div className="grid grid-cols-2 border border-white/[0.08] border-b-0 bg-[#0e0e10] sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
      {METRIC_ORDER.map((id) => {
        const s = summaries[id];
        const selected = active === id;
        const up = s.trendPct > 0.5;
        const down = s.trendPct < -0.5;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={cn(
              "relative flex min-h-[88px] flex-col border-b border-r border-white/[0.08] px-2 py-2.5 text-left transition last:border-r-0 sm:min-h-[96px]",
              "hover:bg-white/[0.02]",
              selected && "bg-[#13131a]"
            )}
          >
            <div className="absolute right-1.5 top-1.5 text-white/25">
              <ChevronsUpDown className="h-3 w-3" aria-hidden />
            </div>
            <div
              className={cn(
                "pr-5 text-[10px] font-medium uppercase tracking-wide text-white/45",
                selected && "text-[#c4a6ff]"
              )}
            >
              {s.label}
            </div>
            <div
              className={cn(
                "mt-1.5 text-lg font-bold tabular-nums leading-none sm:text-xl",
                selected ? "text-[#a970ff]" : "text-white"
              )}
            >
              {formatMetricValue(id, s.value)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] tabular-nums">
              {up ? (
                <TrendingUp className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden />
              ) : down ? (
                <TrendingDown className="h-3 w-3 shrink-0 text-amber-400" aria-hidden />
              ) : (
                <span className="h-3 w-3 shrink-0 rounded-sm bg-white/15" aria-hidden />
              )}
              <span className={cn(up && "text-emerald-400/90", down && "text-amber-400/90", !up && !down && "text-white/40")}>
                {formatTrendPct(s.trendPct)}
              </span>
            </div>
            {selected ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#9147ff] shadow-[0_0_12px_rgba(145,71,255,0.55)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
