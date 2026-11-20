# Whenly

Remember when things happened, from a haircut to buying land, and ask about them in plain words:
"When did my kid last have fever?"

- **Add a memory in one sentence.** "Rohan had a fever yesterday." The date is optional; Claude works it out from the sentence or uses today.
- **Claude files it.** Each memory gets a kind of event (such as *haircut* or *fever*), a person and a category. Different wordings of the same thing ("hair trimmed", "went to the barber") get the same kind, so they count together.
- **It's been…** tiles show how long it has been since the things you care about. Pick them yourself or let the app show what you log most.
- **Ask anything.** Questions are answered from your timeline, with the memories the answer is based on.
- Edit or delete any memory; deleting can be undone.

Built with Next.js, Postgres (Neon) and the Claude API (`claude-opus-5-5`).

## Setup on Vercel

1. Import this repository in Vercel.
2. In the project's **Storage** tab, add a **Neon** Postgres database. It sets `DATABASE_URL` for you. The tables are created on first use.
3. In **Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY`: your key from <https://platform.claude.com>.
   - `APP_PASSWORD`: the password you'll type to sign in.
   - `SESSION_SECRET`: a random string of 32+ characters (`openssl rand -base64 48`).
   - `APP_TIMEZONE` (optional): your time zone, default `Asia/Kolkata`. The browser's time zone is used when available.
4. Redeploy.

## Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## How it works

| Piece | Where |
|---|---|
| Sign-in (one password, signed cookie) | `lib/auth.ts`, `app/login`, `app/api/login` |
| Database (tables `events`, `settings`) | `lib/db.ts` |
| Filing a sentence and answering questions with Claude | `lib/claude.ts` |
| API routes | `app/api/events`, `app/api/ask`, `app/api/settings` |
| The app screen | `components/WhenlyApp.tsx`, `app/globals.css` |

Claude calls use structured outputs, so replies are always valid JSON. If Claude can't be reached when you add a memory, simple keyword rules file it instead, and you can fix the details with Edit.
Requests use server-side refusal fallback (`fallbacks: "default"`), so a request declined by a safety filter is retried on a fallback model automatically.
