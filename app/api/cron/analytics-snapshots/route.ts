import { runAnalyticsSnapshotCron } from "@/lib/analytics/runAnalyticsSnapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authz = req.headers.get("authorization");
  if (authz === `Bearer ${secret}`) return true;
  const q = new URL(req.url).searchParams.get("secret");
  return q === secret;
}

/** Vercel Cron / external worker — call every minute; snapshots are written at most every 5 minutes per session. */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return new Response("Forbidden", { status: 403 });
  }

  const result = await runAnalyticsSnapshotCron();
  return Response.json(result);
}
