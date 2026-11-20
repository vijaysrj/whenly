import { NextResponse } from "next/server";
import { bad, requireSession, todayFor } from "@/lib/api";
import { answerQuestion } from "@/lib/claude";
import { listEvents } from "@/lib/db";

export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim().slice(0, 300) : "";
  if (!question) return bad("Type a question first.");
  const events = await listEvents();
  if (!events.length) {
    return NextResponse.json({ headline: "Nothing yet", answer: "Add a few memories first, then ask away.", ids: [] });
  }
  try {
    return NextResponse.json(await answerQuestion(question, events, todayFor(body?.tz)));
  } catch (error) {
    console.error("ask failed", error);
    return bad("I couldn't answer that just now. Try again in a moment.", 502);
  }
}
