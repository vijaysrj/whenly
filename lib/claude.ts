import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORY_KEYS, isIsoDate, shiftDays, toCategory, type Category, type EventItem } from "./categories";

const MODEL = "claude-opus-5-5";
// Server-side fallback: if a request is declined by a safety classifier, the API
// retries it on a suitable fallback model inside the same call.
const BETAS = ["server-side-fallback-2026-07-01"];

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

export type Filed = { type: string; category: Category; person: string; date: string };

const FILE_SYSTEM = `You file entries for one person's private log of life events, from tiny things (a haircut) to big ones (buying land).
For each entry, decide four things:
- type: a short, lowercase, generic name for the kind of event, 1 to 3 words, such as "haircut", "fever", "health checkup", "dental checkup", "land purchase", "funeral", "car service". The app groups events by this name to show how long it has been since each kind of event, so when an existing type means the same kind of event, reuse it exactly, even when the wording differs: "hair trimmed" and "went to the barber" are both "haircut"; "running a temperature" is "fever".
- category: health (illness, doctors, checkups, medicine), care (haircuts, grooming, fitness), purchase (things bought), home (house, land, property, vehicles, repairs), family (family and social occasions such as weddings, funerals, birthdays, trips), or other.
- person: who it happened to. "Me" when it is about the writer. Otherwise the person's name, capitalized; reuse a known name when it is the same person.
- date: if the writer picked a date, use it exactly. Otherwise work it out from the entry ("yesterday", "last Sunday", "on 3rd March"); if the entry gives no date, use today. Never a date after today.`;

const FiledSchema = z.object({
  type: z.string(),
  category: z.enum(CATEGORY_KEYS),
  person: z.string(),
  date: z.string(),
});

export async function fileEntry(opts: {
  text: string;
  chosenDate: string | null;
  today: string;
  people: string[];
  types: string[];
}): Promise<Filed> {
  const { text, chosenDate, today, people, types } = opts;
  try {
    const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
    const response = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      betas: BETAS,
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(FiledSchema) },
      system: FILE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            `Today is ${today} (${weekday}).`,
            `Known people: ${["Me", ...people.filter((p) => p !== "Me")].join(", ")}.`,
            `Existing event types: ${types.slice(0, 200).join(", ") || "(none yet)"}.`,
            `Date the writer picked: ${chosenDate ?? "none"}.`,
            `Entry: <entry>${text}</entry>`,
          ].join("\n"),
        },
      ],
    });
    const out = response.stop_reason === "refusal" ? null : response.parsed_output;
    if (!out) return localParse(text, chosenDate, today, people);
    let date = chosenDate ?? (isIsoDate(out.date) ? out.date : today);
    if (date > today) date = today;
    return {
      type: cleanType(out.type) || localParse(text, chosenDate, today, people).type,
      category: toCategory(out.category),
      person: cleanName(out.person) || "Me",
      date,
    };
  } catch (error) {
    console.error("fileEntry failed, using local rules", error);
    return localParse(text, chosenDate, today, people);
  }
}

export type Answer = { headline: string; answer: string; ids: string[] };

const ASK_SYSTEM = `You answer questions about one person's private log of life events.
Match by meaning, not exact words: a temperature counts as a fever, a trim as a haircut.
"Me", "I" and "my" mean the writer. "My kid", "the kids", "my son" or "my daughter" mean the people other than Me, unless a name is given.
Count each matching event once. Answer only from the log; if nothing in it fits, say so.
Reply with:
- headline: the key fact in at most 4 words, such as a date ("3 Nov 2026"), a count ("3 times") or a span ("24 days ago"). "Not found" when nothing fits.
- answer: one or two plain sentences that answer the question, saying how long ago where useful. Write dates like "3 Nov 2026".
- ids: the ids of the events the answer rests on, most recent first, at most 6.`;

const AnswerSchema = z.object({
  headline: z.string(),
  answer: z.string(),
  ids: z.array(z.string()),
});

export async function answerQuestion(question: string, events: EventItem[], today: string): Promise<Answer> {
  const lines = events
    .slice(0, 3000)
    .map((e) => `${e.id} | ${e.date} | ${e.type} | ${e.person} | ${e.category} | ${e.text.replace(/\s+/g, " ").slice(0, 300)}`);
  const response = await client().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: BETAS,
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(AnswerSchema) },
    system: ASK_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Today is ${today}.`,
          "<events>",
          "id | date | type | person | category | text (newest first)",
          ...lines,
          "</events>",
          `Question: ${question}`,
        ].join("\n"),
      },
    ],
  });
  const out = response.stop_reason === "refusal" ? null : response.parsed_output;
  if (!out) return { headline: "Can't answer", answer: "I couldn't answer that one. Try asking it another way.", ids: [] };
  return { headline: out.headline.slice(0, 80), answer: out.answer.slice(0, 600), ids: out.ids.slice(0, 6).map(String) };
}

function cleanType(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
}
function cleanName(value: string): string {
  const v = value.replace(/\s+/g, " ").trim().slice(0, 40);
  return v.toLowerCase() === "me" ? "Me" : v;
}

// Simple keyword rules, used only when Claude can't be reached.
const KEYWORDS: [Category, string[]][] = [
  ["home", ["land", "plot", "house", "flat ", "apartment", "registration", "car service", "repair", "plumber", "painted"]],
  ["health", ["fever", "cold", "cough", "sick", "doctor", "checkup", "check-up", "check up", "dentist", "dental", "vaccin", "hospital", "medicine", "vomit", "injur", "blood test", "health"]],
  ["care", ["haircut", "hair cut", "salon", "massage", "trim", "shave", "facial", "barber"]],
  ["family", ["funeral", "wedding", "birthday", "visited", "trip", "attended", "anniversary", "festival", "party"]],
  ["purchase", ["bought", "buy", "purchase", "ordered"]],
];

export function localParse(text: string, chosenDate: string | null, today: string, people: string[]): Filed {
  const t = ` ${text.toLowerCase()} `;
  const category = KEYWORDS.find(([, words]) => words.some((w) => t.includes(w)))?.[0] ?? "other";
  let date = chosenDate;
  let m: RegExpMatchArray | null;
  if (!date) {
    if (/day before yesterday/.test(t)) date = shiftDays(today, 2);
    else if (/yesterday/.test(t)) date = shiftDays(today, 1);
    else if ((m = t.match(/(\d+)\s*days?\s*ago/))) date = shiftDays(today, Number(m[1]));
    else if ((m = t.match(/(\d+)\s*weeks?\s*ago/))) date = shiftDays(today, 7 * Number(m[1]));
    else if (/last week/.test(t)) date = shiftDays(today, 7);
    else date = today;
  }
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const person = people.find((p) => p !== "Me" && new RegExp(`\\b${escape(p)}\\b`, "i").test(text)) ?? "Me";
  const words = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter((w) => w.length > 3);
  return { type: words[words.length - 1] ?? "event", category, person, date };
}
