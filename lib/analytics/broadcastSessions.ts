import { prisma } from "@/lib/prisma";

/**
 * EventSub `stream.online` / `stream.offline` (webhook or future transports) — keep `LiveBroadcastSession`
 * rows in sync so the snapshot cron can poll Helix while the channel is live.
 */
export async function handleTwitchStreamOnlineEvent(
  broadcasterUserId: string,
  startedAtIso?: string | null
): Promise<void> {
  const account = await prisma.account.findFirst({
    where: { provider: "twitch", providerAccountId: broadcasterUserId },
    select: { userId: true }
  });
  if (!account) return;

  const startedAt = startedAtIso ? new Date(startedAtIso) : new Date();

  await prisma.liveBroadcastSession.updateMany({
    where: { channelTwitchId: broadcasterUserId, endedAt: null },
    data: { endedAt: new Date() }
  });

  await prisma.liveBroadcastSession.create({
    data: {
      userId: account.userId,
      channelTwitchId: broadcasterUserId,
      startedAt
    }
  });
}

export async function handleTwitchStreamOfflineEvent(broadcasterUserId: string): Promise<void> {
  await prisma.liveBroadcastSession.updateMany({
    where: { channelTwitchId: broadcasterUserId, endedAt: null },
    data: { endedAt: new Date() }
  });
}
