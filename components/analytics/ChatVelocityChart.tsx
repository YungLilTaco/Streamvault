"use client";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { ChatVelocityPoint } from "@/lib/analytics/types";

function VelocityTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: ChatVelocityPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-white/10 bg-[#18181b]/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur transition-none">
      <div className="text-[10px] text-white/50">{p.label}</div>
      <div className="text-white/90">Viewers: {p.viewers.toFixed(1)}</div>
      <div className="text-[#c4a6ff]">MPM: {p.mpm.toFixed(1)}</div>
    </div>
  );
}

export function ChatVelocityChart({ data }: { data: ChatVelocityPoint[] }) {
  const chartData = data.map((d) => ({ ...d }));
  return (
    <div className="border border-white/[0.08] bg-[#0e0e10]">
      <div className="border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold text-white">Chat velocity</h2>
        <p className="mt-0.5 text-[11px] text-white/45">Viewer count vs messages per minute (MPM)</p>
      </div>
      <div className="h-[280px] w-full min-w-0 px-2 pb-3 pt-2 sm:h-[300px] sm:px-4 sm:pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              yAxisId="left"
              width={36}
              tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              width={36}
              tick={{ fill: "rgba(196,166,255,0.75)", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              isAnimationActive={false}
              animationDuration={0}
              animationEasing="linear"
              wrapperStyle={{ transition: "none" }}
              content={<VelocityTooltip />}
              cursor={{ stroke: "rgba(145,71,255,0.25)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              formatter={(value) => <span className="text-white/70">{value}</span>}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="viewers"
              name="Avg viewers"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 3 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="mpm"
              name="MPM"
              stroke="#9147ff"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
