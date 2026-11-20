import { NextResponse } from "next/server";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !checkPassword(password)) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
