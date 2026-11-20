import { NextResponse } from "next/server";
import { bad, requireSession, todayFor } from "@/lib/api";
import { isIsoDate, toCategory } from "@/lib/categories";
import { fileEntry } from "@/lib/claude";
import { insertEvent, listEvents } from "@/lib/db";

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  return NextResponse.json({ events: await listEvents() });
}

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 400) : "";
  if (!text) return bad("Write what happened first.");
  const today = todayFor(body?.tz);

  // Restoring a deleted event (undo): keep its fields exactly as they were.
  if (body?.restore) {
    if (!isIsoDate(body.date)) return bad("That date isn't valid.");
    const event = await insertEvent(
      {
        text,
        date: body.date,
        type: String(body.type ?? "").slice(0, 40),
        category: toCategory(body.category),
        person: String(body.person ?? "Me").slice(0, 40) || "Me",
      },
      typeof body.createdAt === "string" ? body.createdAt : undefined,
    );
    return NextResponse.json({ event });
  }

  let chosenDate: string | null = null;
  if (body?.date) {
    if (!isIsoDate(body.date)) return bad("That date isn't valid.");
    if (body.date > today) return bad("Pick a date that isn't in the future.");
    chosenDate = body.date;
  }
  const existing = await listEvents();
  const people = Array.from(new Set(existing.map((e) => e.person)));
  const counts = new Map<string, number>();
  for (const e of existing) if (e.type) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  const types = Array.from(counts.keys()).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));

  const filed = await fileEntry({ text, chosenDate, today, people, types });
  const event = await insertEvent({ text, ...filed });
  return NextResponse.json({ event });
}
