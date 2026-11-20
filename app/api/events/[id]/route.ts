import { NextResponse } from "next/server";
import { bad, requireSession, todayFor } from "@/lib/api";
import { isIsoDate, toCategory } from "@/lib/categories";
import { deleteEvent, updateEvent } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("Not found.", 404);
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 400) : "";
  if (!text) return bad("Write what happened.");
  if (!isIsoDate(body?.date)) return bad("Pick a valid date.");
  if (body.date > todayFor(body?.tz)) return bad("Pick a date that isn't in the future.");
  const event = await updateEvent(id, {
    text,
    date: body.date,
    type: String(body.type ?? "").toLowerCase().trim().slice(0, 40),
    category: toCategory(body.category),
    person: String(body.person ?? "").trim().slice(0, 40) || "Me",
  });
  if (!event) return bad("That memory no longer exists.", 404);
  return NextResponse.json({ event });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireSession();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("Not found.", 404);
  await deleteEvent(id);
  return NextResponse.json({ ok: true });
}
