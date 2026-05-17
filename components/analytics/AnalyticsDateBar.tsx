"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/components/lib/cn";
import type { TimePreset } from "@/lib/analytics/types";

const PRESET_LABELS: { id: TimePreset; label: string }[] = [
  { id: "1w", label: "1 Week" },
  { id: "1m", label: "1 Month" },
  { id: "3m", label: "3 Months" },
  { id: "6m", label: "6 Months" },
  { id: "1y", label: "1 Year" }
];

export function AnalyticsDateBar({
  rangeLabel,
  sublabel,
  pageOffset,
  onPagePrev,
  onPageNext,
  preset,
  onPresetChange,
  className
}: {
  rangeLabel: string;
  sublabel: string;
  pageOffset: number;
  onPagePrev: () => void;
  onPageNext: () => void;
  preset: TimePreset;
  onPresetChange: (p: TimePreset) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border border-white/[0.08] bg-[#0e0e10] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 sm:justify-center sm:gap-6">
        <button
          type="button"
          onClick={onPagePrev}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-white/70 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
          aria-label="Previous period"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-medium text-[#a970ff] sm:text-base">{rangeLabel}</div>
          <div className="text-[11px] text-white/45">{sublabel}</div>
        </div>
        <button
          type="button"
          onClick={onPageNext}
          disabled={pageOffset <= 0}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-white/70 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white disabled:pointer-events-none disabled:opacity-30"
          aria-label="Next period"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 border-t border-white/[0.06] pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        {PRESET_LABELS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPresetChange(id)}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition sm:text-xs",
              preset === id
                ? "bg-[#9147ff]/20 text-[#c4a6ff] ring-1 ring-[#9147ff]/40"
                : "text-white/50 hover:bg-white/[0.04] hover:text-white/75"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
