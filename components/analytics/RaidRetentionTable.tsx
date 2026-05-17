"use client";

import type { RaidRetentionRow } from "@/lib/analytics/types";

export function RaidRetentionTable({ rows }: { rows: RaidRetentionRow[] }) {
  return (
    <div className="border border-white/[0.08] bg-[#0e0e10]">
      <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold text-white">Raid performance &amp; retention</h2>
        <span className="text-[10px] text-white/40">15-min chat retention</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] font-semibold uppercase tracking-wide text-white/45">
              <th className="px-3 py-2 sm:px-4">Incoming channel</th>
              <th className="px-3 py-2 sm:px-4">Raid size</th>
              <th className="px-3 py-2 sm:px-4">15-min retention</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-sm text-white/45 sm:px-4">
                  Raid retention analytics are not wired to storage yet. Incoming raids still appear in your activity
                  feed when EventSub is connected.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-medium text-white/90 sm:px-4">{r.incomingChannel}</td>
                  <td className="px-3 py-2.5 tabular-nums text-white/75 sm:px-4">
                    {new Intl.NumberFormat("en-US").format(r.raidSize)}
                  </td>
                  <td className="px-3 py-2.5 sm:px-4">
                    <span
                      className={
                        r.retention15mPct >= 45
                          ? "text-emerald-400"
                          : r.retention15mPct >= 25
                            ? "text-white/80"
                            : "text-amber-400/90"
                      }
                    >
                      {r.retention15mPct}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
