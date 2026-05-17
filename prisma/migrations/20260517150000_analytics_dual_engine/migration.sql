-- Dual-engine analytics: daily CSV rollups + live 5-minute stream snapshots.

CREATE TABLE "ChannelAnalyticsSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "avgViewers" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxViewers" INTEGER NOT NULL DEFAULT 0,
    "follows" INTEGER NOT NULL DEFAULT 0,
    "subs" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minutesStreamed" INTEGER NOT NULL DEFAULT 0,
    "liveViews" INTEGER NOT NULL DEFAULT 0,
    "uniqueChatters" INTEGER NOT NULL DEFAULT 0,
    "clipsCreated" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChannelAnalyticsSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelAnalyticsSummary_userId_date_key" ON "ChannelAnalyticsSummary"("userId", "date");
CREATE INDEX "ChannelAnalyticsSummary_userId_date_idx" ON "ChannelAnalyticsSummary"("userId", "date");

ALTER TABLE "ChannelAnalyticsSummary" ADD CONSTRAINT "ChannelAnalyticsSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StreamSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelTwitchId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "currentViewers" INTEGER NOT NULL DEFAULT 0,
    "messagesPerMinute" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StreamSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StreamSnapshot_userId_timestamp_idx" ON "StreamSnapshot"("userId", "timestamp");
CREATE INDEX "StreamSnapshot_channelTwitchId_timestamp_idx" ON "StreamSnapshot"("channelTwitchId", "timestamp");

ALTER TABLE "StreamSnapshot" ADD CONSTRAINT "StreamSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LiveBroadcastSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelTwitchId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "lastSnapshotAt" TIMESTAMP(3),

    CONSTRAINT "LiveBroadcastSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveBroadcastSession_userId_endedAt_idx" ON "LiveBroadcastSession"("userId", "endedAt");
CREATE INDEX "LiveBroadcastSession_channelTwitchId_startedAt_idx" ON "LiveBroadcastSession"("channelTwitchId", "startedAt");

ALTER TABLE "LiveBroadcastSession" ADD CONSTRAINT "LiveBroadcastSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
