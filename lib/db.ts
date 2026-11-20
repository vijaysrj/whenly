import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { toCategory, type Category, type EventItem } from "./categories";

let client: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

function sql(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL must be set.");
    client = neon(url);
  }
  return client;
}

/** Returns the query function once the tables exist (created on first use). */
async function db(): Promise<NeonQueryFunction<false, false>> {
  const q = sql();
  if (!schemaReady) {
    schemaReady = (async () => {
      await q`
        create table if not exists events (
          id uuid primary key default gen_random_uuid(),
          text text not null,
          date date not null,
          type text not null default '',
          category text not null default 'other',
          person text not null default 'Me',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )`;
      await q`create index if not exists events_date_idx on events (date desc, created_at desc)`;
      await q`create table if not exists settings (key text primary key, value jsonb not null)`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
  return q;
}

type Row = Record<string, unknown>;

function toEvent(row: Row): EventItem {
  return {
    id: String(row.id),
    text: String(row.text ?? ""),
    date: String(row.date),
    type: String(row.type ?? ""),
    category: toCategory(row.category),
    person: String(row.person ?? "Me"),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
  };
}

export async function listEvents(): Promise<EventItem[]> {
  const q = await db();
  const rows = (await q`
    select id, text, to_char(date, 'YYYY-MM-DD') as date, type, category, person, created_at
    from events order by date desc, created_at desc`) as Row[];
  return rows.map(toEvent);
}

export type EventInput = { text: string; date: string; type: string; category: Category; person: string };

export async function insertEvent(input: EventInput, createdAt?: string): Promise<EventItem> {
  const q = await db();
  const rows = (await q`
    insert into events (text, date, type, category, person, created_at)
    values (${input.text}, ${input.date}, ${input.type}, ${input.category}, ${input.person}, coalesce(${createdAt ?? null}::timestamptz, now()))
    returning id, text, to_char(date, 'YYYY-MM-DD') as date, type, category, person, created_at`) as Row[];
  return toEvent(rows[0]);
}

export async function updateEvent(id: string, input: EventInput): Promise<EventItem | null> {
  const q = await db();
  const rows = (await q`
    update events set text = ${input.text}, date = ${input.date}, type = ${input.type},
      category = ${input.category}, person = ${input.person}, updated_at = now()
    where id = ${id}
    returning id, text, to_char(date, 'YYYY-MM-DD') as date, type, category, person, created_at`) as Row[];
  return rows[0] ? toEvent(rows[0]) : null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const q = await db();
  const rows = (await q`delete from events where id = ${id} returning id`) as Row[];
  return rows.length > 0;
}

export async function getPinned(): Promise<string[]> {
  const q = await db();
  const rows = (await q`select value from settings where key = 'pinned'`) as Row[];
  const value = rows[0]?.value;
  return Array.isArray(value) ? value.map(String) : [];
}

export async function setPinned(pinned: string[]): Promise<void> {
  const q = await db();
  const value = JSON.stringify(pinned);
  await q`
    insert into settings (key, value) values ('pinned', ${value}::jsonb)
    on conflict (key) do update set value = excluded.value`;
}
