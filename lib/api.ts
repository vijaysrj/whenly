import { NextResponse } from "next/server";
import { isSignedIn } from "./auth";
import { todayIn } from "./categories";

export async function requireSession(): Promise<NextResponse | null> {
  if (await isSignedIn()) return null;
  return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
}

export function todayFor(tz: unknown): string {
  const zone = typeof tz === "string" && tz.length < 64 ? tz : process.env.APP_TIMEZONE || "Asia/Kolkata";
  return todayIn(zone);
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
