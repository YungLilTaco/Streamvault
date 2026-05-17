import { Suspense } from "react";
import { AnalyticsPageClient } from "@/components/analytics/AnalyticsPageClient";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="min-w-0 flex-1 px-4 py-10 text-sm text-white/55">Loading analytics…</div>}>
      <AnalyticsPageClient />
    </Suspense>
  );
}
