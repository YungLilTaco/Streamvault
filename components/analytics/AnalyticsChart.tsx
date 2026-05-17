"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type {
  AnalyticsMetricId,
  AnalyticsPoint,
  ChartResolution,
  MetricSummary
} from "@/lib/analytics/types";
import { formatTooltipValue } from "@/lib/analytics/formatters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import { cn } from "@/components/lib/cn";

function isEffectivelyEmptySeries(series: readonly AnalyticsPoint[]): boolean {
  if (series.length === 0) return true;
  return series.every((p) => !Number.isFinite(p.v) || p.v === 0);
}

const RESOLUTIONS: { id: ChartResolution; label: string }[] = [
  { id: "hour", label: "Hour" },
  { id: "day", label: "Day" },
  { id: "week", label: "Week" }
];

function ChartTooltip({
  active,
  payload,
  metricId
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; v: number } }>;
  metricId: AnalyticsMetricId;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-md border border-white/10 bg-[#18181b]/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur transition-none">
      <div className="text-[10px] text-white/50">{row.label}</div>
      <div className="font-semibold tabular-nums text-white">{formatTooltipValue(metricId, row.v)}</div>
    </div>
  );
}

export function AnalyticsChart({
  summary,
  resolution,
  onResolutionChange
}: {
  summary: MetricSummary;
  resolution: ChartResolution;
  onResolutionChange: (r: ChartResolution) => void;
}) {
  const data = summary.series.map((p: AnalyticsPoint) => ({ ...p }));
  const resLabel = RESOLUTIONS.find((r) => r.id === resolution)?.label ?? "Day";
  const showEmptyState = isEffectivelyEmptySeries(summary.series);

  return (
    <div className="relative border border-t-0 border-white/[0.08] bg-[#0e0e10] px-2 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">
      <div className="absolute right-2 top-2 z-10 sm:right-4 sm:top-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              className="h-7 gap-1 border-white/15 bg-black/40 px-2 text-[11px] text-white/80 hover:bg-white/[0.06]"
            >
              {resLabel}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            {RESOLUTIONS.map((r) => (
              <DropdownMenuItem
                key={r.id}
                onClick={() => onResolutionChange(r.id)}
                className={cn(resolution === r.id && "bg-primary/15 text-primary")}
              >
                {r.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="h-[280px] w-full min-w-0 pt-8 sm:h-[320px] sm:pt-6">
        {showEmptyState ? (
          <div className="flex h-full items-center justify-center px-3 pb-2">
            <Card className="max-w-lg border-white/[0.12] bg-[#18181b]/90 px-5 py-8 text-center shadow-none">
              <h3 className="text-base font-semibold tracking-tight text-white">No Historical Analytics Found</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Twitch&apos;s API restricts external applications from accessing your historical stream analytics
                automatically. To instantly populate your entire stream history in Streamcore, export your data from
                the{" "}
                <a
                  href="https://dashboard.twitch.tv/analytics/channel-analytics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-purple-500 underline decoration-purple-500/35 underline-offset-2 hover:text-purple-400 hover:decoration-purple-400/50"
                >
                  Twitch Channel Analytics Dashboard
                </a>{" "}
                and drop the file into the importer at the bottom of this page.
              </p>
            </Card>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="svAnalyticsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9147ff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#9147ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                width={40}
                tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
              />
              <Tooltip
                isAnimationActive={false}
                animationDuration={0}
                animationEasing="linear"
                wrapperStyle={{ transition: "none" }}
                content={<ChartTooltip metricId={summary.id} />}
                cursor={{ stroke: "rgba(145,71,255,0.35)" }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="#9147ff"
                strokeWidth={2}
                fill="url(#svAnalyticsFill)"
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: "#c4a6ff", stroke: "#9147ff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] text-white/45">
        <span className="inline-block h-2 w-2 rounded-sm bg-[#9147ff]" aria-hidden />
        <span>{summary.label}</span>
      </div>
    </div>
  );
}
