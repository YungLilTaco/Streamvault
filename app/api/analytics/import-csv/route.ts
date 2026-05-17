import { auth } from "@/auth";
import { importTwitchChannelAnalyticsCsv } from "@/lib/analytics/csvImporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return Response.json({ message: "Expected multipart/form-data with field \"file\"" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ message: "Invalid form body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return Response.json({ message: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ message: "File too large (max 4 MB)" }, { status: 413 });
  }

  const text = await file.text();
  const result = await importTwitchChannelAnalyticsCsv(session.user.id, text);

  return Response.json(result);
}
