import { auth } from "@/auth";
import { loadAnalyticsPayload } from "@/lib/analytics/dataLoaders";
import type { ChartResolution, TimePreset } from "@/lib/analytics/types";
import { isValidPreset, isValidResolution } from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readOffset(sp: URLSearchParams): number {
  const raw = sp.get("offset");
  if (raw == null) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const presetRaw = searchParams.get("preset");
  const preset: TimePreset = isValidPreset(presetRaw) ? presetRaw : "1m";
  const resolutionRaw = searchParams.get("resolution");
  const resolution: ChartResolution = isValidResolution(resolutionRaw) ? resolutionRaw : "day";
  const pageOffset = readOffset(searchParams);

  const payload = await loadAnalyticsPayload({
    userId: session.user.id,
    preset,
    pageOffset,
    resolution
  });

  return Response.json(payload);
}
