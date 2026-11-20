"use client";

import { useState } from "react";
import { LogoMark } from "@/components/Icons";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't sign in. Try again.");
    } catch {
      setError("Couldn't reach Whenly. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          <LogoMark />
          Whenly
        </div>
        <h1>Welcome back<span style={{ color: "var(--coral)" }}>.</span></h1>
        <p>Enter your password to open your memories.</p>
        <label className="sr" htmlFor="password">Password</label>
        <input id="password" className="field" type="password" autoComplete="current-password" autoFocus placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="err" role="alert">{error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ height: 52 }}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
