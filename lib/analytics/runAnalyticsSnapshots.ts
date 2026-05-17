import { prisma } from "@/lib/prisma";
import { getProviderAccessToken } from "@/lib/tokens";

const FIVE_MIN_MS = 5 * 60 * 1000;

async function helixViewerCount(userId: string, channelTwitchId: string): Promise<number | null> {
  const { accessToken } = await getProviderAccessToken(userId, "twitch");
  const cid = process.env.TWITCH_CLIENT_ID?.trim();
  if (!cid) return null;

  const res = await fetch(
    `https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(channelTwitchId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": cid
      },
      cache: "no-store"
    }
  );
  if (!res.ok) {
    throw new Error(`Helix streams HTTP ${res.status}`);
  }
  const json = (await res.json()) as { data?: { viewer_count?: number }[] };
  if (!json.data?.length) return null;
  const n = json.data[0]?.viewer_count;
  return typeof n === "number" ? n : 0;
}

async function messagesLastFiveMinutes(channelTwitchId: string): Promise<number> {
  const since = BigInt(Date.now() - FIVE_MIN_MS);
  return prisma.chatMessageArchive.count({
    where: { channelTwitchId, ts: { gte: since }, deletedAt: null }
  });
}

/**
 * Called from `GET /api/cron/analytics-snapshots` — writes `StreamSnapshot` every ~5 minutes
 * for each open `LiveBroadcastSession`, and closes sessions when Helix reports offline.
 */
export async function runAnalyticsSnapshotCron(): Promise<{
  written: number;
  closed: number;
  errors: string[];
}> {
  const sessions = await prisma.liveBroadcastSession.findMany({
    where: { endedAt: null }
  });

  const errors: string[] = [];
  let written = 0;
  let closed = 0;
  const now = Date.now();

  for (const s of sessions) {
    let viewers: number | null;
    try {
      viewers = await helixViewerCount(s.userId, s.channelTwitchId);
    } catch (e) {
      errors.push(`${s.channelTwitchId}: ${(e as Error).message}`);
      continue;
    }

    if (viewers == null) {
      await prisma.liveBroadcastSession.update({
        where: { id: s.id },
        data: { endedAt: new Date() }
      });
      closed += 1;
      continue;
    }

    const last = s.lastSnapshotAt?.getTime() ?? 0;
    if (last && now - last < FIVE_MIN_MS) continue;

    const msg5m = await messagesLastFiveMinutes(s.channelTwitchId);
    const mpm = Math.round(msg5m / 5);

    await prisma.$transaction([
      prisma.streamSnapshot.create({
        data: {
          userId: s.userId,
          channelTwitchId: s.channelTwitchId,
          timestamp: new Date(),
          currentViewers: viewers,
          messagesPerMinute: mpm
        }
      }),
      prisma.liveBroadcastSession.update({
        where: { id: s.id },
        data: { lastSnapshotAt: new Date() }
      })
    ]);
    written += 1;
  }

  return { written, closed, errors };
}
