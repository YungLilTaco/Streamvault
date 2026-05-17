"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpCircle, Upload } from "lucide-react";
import { AnalyticsDateBar } from "@/components/analytics/AnalyticsDateBar";
import { AnalyticsTabs } from "@/components/analytics/AnalyticsTabs";
import { AnalyticsChart } from "@/components/analytics/AnalyticsChart";
import { RaidRetentionTable } from "@/components/analytics/RaidRetentionTable";
import { ChatVelocityChart } from "@/components/analytics/ChatVelocityChart";
import {
  computeDateWindow,
  isValidMetric,
  isValidPreset,
  isValidResolution,
  type AnalyticsApiPayload,
  type AnalyticsMetricId,
  type ChartResolution,
  type TimePreset
} from "@/lib/analytics/types";

const DEFAULT_PRESET: TimePreset = "1m";
const DEFAULT_METRIC: AnalyticsMetricId = "averageViewers";
const DEFAULT_RESOLUTION: ChartResolution = "day";

function readInt(sp: URLSearchParams, key: string, fallback: number): number {
  const raw = sp.get(key);
  if (raw == null) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function emptySummaries(): AnalyticsApiPayload["summaries"] {
  return {} as AnalyticsApiPayload["summaries"];
}

export function AnalyticsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const presetRaw = searchParams.get("preset");
  const preset: TimePreset = isValidPreset(presetRaw) ? presetRaw : DEFAULT_PRESET;
  const metricRaw = searchParams.get("metric");
  const metric: AnalyticsMetricId = isValidMetric(metricRaw) ? metricRaw : DEFAULT_METRIC;
  const resolutionRaw = searchParams.get("resolution");
  const resolution: ChartResolution = isValidResolution(resolutionRaw) ? resolutionRaw : DEFAULT_RESOLUTION;
  const pageOffset = readInt(searchParams, "offset", 0);

  const pushParams = React.useCallback(
    (next: Record<string, string | number | undefined>) => {
      const n = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === undefined || v === "") n.delete(k);
        else n.set(k, String(v));
      }
      router.push(`/app/analytics?${n.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const { rangeLabel, sublabel } = React.useMemo(() => computeDateWindow(preset, pageOffset), [preset, pageOffset]);

  const [payload, setPayload] = React.useState<AnalyticsApiPayload | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [importBusy, setImportBusy] = React.useState(false);
  const [importMsg, setImportMsg] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({
      preset,
      offset: String(pageOffset),
      resolution
    });
    setLoading(true);
    setLoadError(null);
    fetch(`/api/analytics/data?${qs.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = (await r.json().catch(() => null)) as { message?: string } | null;
          throw new Error(j?.message ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<AnalyticsApiPayload>;
      })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setLoadError(e.message || "Failed to load analytics");
          setPayload(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preset, pageOffset, resolution]);

  const summaries = payload?.summaries ?? emptySummaries();
  const activeSummary = summaries[metric];
  const velocity = payload?.velocity ?? [];
  const raids = payload?.raids ?? [];

  const runImportFile = React.useCallback(async (file: File) => {
    setImportBusy(true);
    setImportMsg(null);
    const fd = new FormData();
    fd.set("file", file);
    try {
      const r = await fetch("/api/analytics/import-csv", { method: "POST", body: fd });
      const j = (await r.json()) as { imported?: number; skipped?: number; errors?: string[]; message?: string };
      if (!r.ok) {
        setImportMsg(j.message ?? `Import failed (${r.status})`);
        return;
      }
      const errs = j.errors?.length ? ` — ${j.errors.slice(0, 3).join("; ")}` : "";
      setImportMsg(`Imported ${j.imported ?? 0} row(s), skipped ${j.skipped ?? 0}.${errs}`);
      const qs = new URLSearchParams({
        preset,
        offset: String(pageOffset),
        resolution
      });
      const refresh = await fetch(`/api/analytics/data?${qs.toString()}`);
      if (refresh.ok) {
        setPayload((await refresh.json()) as AnalyticsApiPayload);
      }
    } catch {
      setImportMsg("Network error during import");
    } finally {
      setImportBusy(false);
    }
  }, [pageOffset, preset, resolution]);

  const onFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) void runImportFile(f);
    },
    [runImportFile]
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && (f.type === "text/csv" || f.name.toLowerCase().endsWith(".csv"))) void runImportFile(f);
      else setImportMsg("Please drop a .csv file from Twitch Channel Analytics.");
    },
    [runImportFile]
  );

  return (
    <div className="min-w-0 flex-1 pb-16">
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />

      <div className="mx-auto max-w-[1200px] px-3 py-6 sm:px-5 sm:py-8">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#a970ff]">StreamCore</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">Channel analytics</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          See how your channel grows over time. We combine what you import with what we learn whenever you go live.
        </p>

        {loadError ? (
          <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
            {loadError}
          </div>
        ) : null}

        {payload && !loadError ? (
          <div
            className="mt-4 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-4 text-sm leading-relaxed text-white/75 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            role="region"
            aria-label="How Streamcore analytics works"
          >
            <p className="text-[15px] font-medium leading-snug text-white/90">
              Welcome to your Streamcore Analytics! From the moment you connect your Twitch account, we automatically
              log and track every live stream moving forward.
            </p>
            <p className="mt-3 leading-relaxed">
              Sadly, Twitch keeps your past channel history locked behind their closed platform. If you want to view
              your older analytics right here inside Streamcore, simply download your data from the{" "}
              <a
                href="https://dashboard.twitch.tv/analytics/channel-analytics"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-purple-500 underline decoration-purple-500/40 underline-offset-2 hover:text-purple-400 hover:decoration-purple-400/60"
              >
                Twitch Channel Analytics Dashboard
              </a>{" "}
              and drop the file into the importer tool at the bottom of this page!
            </p>
          </div>
        ) : null}

        {importMsg ? (
          <div className="mt-2 text-xs text-white/55" role="status">
            {importMsg}
          </div>
        ) : null}

        <div className="mt-6 space-y-0">
          <AnalyticsDateBar
            rangeLabel={rangeLabel}
            sublabel={sublabel}
            pageOffset={pageOffset}
            onPagePrev={() => pushParams({ offset: pageOffset + 1 })}
            onPageNext={() => pushParams({ offset: Math.max(0, pageOffset - 1) })}
            preset={preset}
            onPresetChange={(p) => pushParams({ preset: p, offset: 0 })}
          />
          {loading || !activeSummary ? (
            <div className="border border-white/[0.08] bg-[#0e0e10] px-4 py-16 text-center text-sm text-white/50">
              Loading analytics…
            </div>
          ) : (
            <>
              <AnalyticsTabs summaries={summaries} active={metric} onSelect={(id) => pushParams({ metric: id })} />
              <AnalyticsChart
                summary={activeSummary}
                resolution={resolution}
                onResolutionChange={(r) => pushParams({ resolution: r })}
              />
            </>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-1">
          <RaidRetentionTable rows={raids} />
          {loading ? (
            <div className="border border-white/[0.08] bg-[#0e0e10] px-4 py-10 text-center text-sm text-white/50">
              Loading engagement…
            </div>
          ) : (
            <ChatVelocityChart data={velocity} />
          )}
        </div>

        <div className="mt-6 grid gap-px border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
          <button
            type="button"
            className="w-full bg-[#0e0e10] py-3 text-center text-sm font-medium text-[#a970ff] transition hover:bg-white/[0.02]"
          >
            Export data
          </button>
          <button
            type="button"
            disabled={importBusy}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              "flex w-full items-center justify-center gap-2 bg-[#0e0e10] py-3 text-center text-sm font-medium transition",
              dragOver ? "bg-[#9147ff]/15 text-white" : "text-white/80 hover:bg-white/[0.02]"
            ].join(" ")}
          >
            <Upload className="h-4 w-4 shrink-0 text-[#a970ff]" aria-hidden />
            {importBusy ? "Importing…" : "Import Twitch CSV history"}
          </button>
        </div>

        <div className="mt-4 flex items-start gap-2 text-[11px] text-white/45">
          <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden />
          <span>
            Not sure what these stats mean?{" "}
            <a
              href="https://help.twitch.tv/s/article/channel-analytics-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a970ff] underline decoration-[#9147ff]/40 underline-offset-2 hover:text-white"
            >
              Twitch&apos;s channel analytics guide
            </a>
            .
          </span>
        </div>
      </div>
    </div>
  );
}
