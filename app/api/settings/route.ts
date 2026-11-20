import { NextResponse } from "next/server";
import { bad, requireSession } from "@/lib/api";
import { getPinned, setPinned } from "@/lib/db";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json({ pinned: await getPinned() });
}

export async function PUT(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.pinned)) return bad("Send a list of event types.");
  const pinned = body.pinned.map((p: unknown) => String(p).slice(0, 40)).slice(0, 24);
  await setPinned(pinned);
  return NextResponse.json({ pinned });
}
