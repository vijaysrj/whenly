"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORY_KEYS, CATEGORY_LABELS, toCategory, type Category, type EventItem } from "@/lib/categories";

type Answer = { headline: string; answer: string; ids: string[] };
type ToastAction = { label: string; run: () => void };
type Toast = { message: string; actions: ToastAction[] } | null;

const EXAMPLES = ["Got a haircut", "Health checkup at the clinic", "Attended a funeral last Sunday"];
const SUGGESTIONS = [
  "When did my kid last have fever?",
  "When was my last haircut?",
  "How many times did the kids fall sick this year?",
  "When did I buy the land?",
];

const ICONS: Record<Category, React.ReactNode> = {
  health: (<><path d="M20.8 8.6a5 5 0 0 0-8.8-3.2 5 5 0 0 0-8.8 3.2c0 5.4 8.8 11 8.8 11s8.8-5.6 8.8-11z" /><path d="M3.5 12h4l2-3 3 6 2-3h6" /></>),
  care: (<><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12" /></>),
  purchase: (<><path d="M6 7h12l1 14H5L6 7z" /><path d="M9 7a3 3 0 0 1 6 0" /></>),
  home: (<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  family: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>),
  other: (<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>),
};

function Icon({ category, size }: { category: Category; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[category]}
    </svg>
  );
}

// ---------- dates ----------
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
function localToday(): Date { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function iso(d: Date): string { const m = d.getMonth() + 1, dd = d.getDate(); return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${dd < 10 ? "0" : ""}${dd}`; }
function fromIso(s: string): Date { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function fmt(s: string): string { return fromIso(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
function daysSince(s: string): number { return Math.round((localToday().getTime() - fromIso(s).getTime()) / 86400000); }
function ago(s: string): string {
  const n = daysSince(s);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return `${n} days ago`;
  if (n < 60) return `${Math.round(n / 7)} weeks ago`;
  if (n < 365) return `${Math.round(n / 30)} months ago`;
  const y = Math.round(n / 365);
  return `${y} ${y === 1 ? "year" : "years"} ago`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const catStyle = (c: Category) => ({ ["--tint" as string]: `var(--${c}-tint)`, ["--tink" as string]: `var(--${c}-ink)` }) as React.CSSProperties;
function sortEvents(list: EventItem[]): EventItem[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.createdAt < b.createdAt ? 1 : -1));
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (res.status === 401) { window.location.href = "/login"; throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data as T;
}

export default function WhenlyApp({ initialEvents, initialPinned }: { initialEvents: EventItem[]; initialPinned: string[] }) {
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [pinned, setPinned] = useState<string[]>(initialPinned);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [addText, setAddText] = useState("");
  const [addDate, setAddDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [now, setNow] = useState<Date | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const askSeq = useRef(0);
  const addInput = useRef<HTMLInputElement>(null);
  const timelineHead = useRef<HTMLHeadingElement>(null);

  useEffect(() => { setNow(new Date()); }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function showToast(message: string, actions: ToastAction[] = []) {
    setToast({ message, actions });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), actions.length ? 7000 : 3500);
  }

  const sorted = useMemo(() => sortEvents(events), [events]);
  const people = useMemo(() => Array.from(new Set(["Me", ...events.map((e) => e.person)])), [events]);
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) if (e.type) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return Array.from(counts.keys()).sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
  }, [events]);

  const tileTypes = useMemo(() => {
    if (pinned.length) return pinned.filter((p) => types.includes(p));
    const counts = new Map<string, number>();
    const recent: string[] = [];
    for (const e of sorted) {
      if (!e.type) continue;
      counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
      if (!recent.includes(e.type)) recent.push(e.type);
    }
    const repeats = recent.filter((t) => (counts.get(t) ?? 0) > 1);
    return (repeats.length >= 2 ? repeats : recent).slice(0, 4);
  }, [pinned, types, sorted]);

  const shown = sorted.filter((e) => (filter === "all" || e.category === filter) && (!typeFilter || e.type === typeFilter));
  const groups = useMemo(() => {
    const out: { key: string; month: string; year: number; items: EventItem[] }[] = [];
    for (const e of shown) {
      const d = fromIso(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = out.find((x) => x.key === key);
      if (!g) { g = { key, month: d.toLocaleDateString("en-GB", { month: "long" }), year: d.getFullYear(), items: [] }; out.push(g); }
      g.items.push(e);
    }
    return out;
  }, [shown]);

  const categoryCounts = useMemo(() => {
    const c: Partial<Record<Category, number>> = {};
    for (const e of events) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [events]);

  // ---------- actions ----------
  async function addMemory(event: React.FormEvent) {
    event.preventDefault();
    const text = addText.trim();
    if (!text) { addInput.current?.focus(); return; }
    setAdding(true);
    try {
      const { event: saved } = await api<{ event: EventItem }>("/api/events", { method: "POST", body: JSON.stringify({ text, date: addDate || null, tz: tz() }) });
      setEvents((list) => [saved, ...list]);
      setAddText(""); setAddDate("");
      showToast(`Filed as ${cap(saved.type || CATEGORY_LABELS[saved.category])} · ${saved.person} · ${fmt(saved.date)}`, [
        { label: "Edit", run: () => { setEditingId(saved.id); setConfirmingId(null); setFilter("all"); setTypeFilter(null); } },
        { label: "Undo", run: () => removeMemory(saved, false) },
      ]);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function removeMemory(item: EventItem, offerUndo = true) {
    setConfirmingId(null);
    setEvents((list) => list.filter((x) => x.id !== item.id));
    try {
      await api(`/api/events/${item.id}`, { method: "DELETE" });
      if (offerUndo) showToast("Memory deleted", [{ label: "Undo", run: () => restoreMemory(item) }]);
      else showToast("Removed");
    } catch (e) {
      setEvents((list) => [item, ...list]);
      showToast((e as Error).message);
    }
  }

  async function restoreMemory(item: EventItem) {
    try {
      const { event: saved } = await api<{ event: EventItem }>("/api/events", { method: "POST", body: JSON.stringify({ ...item, restore: true }) });
      setEvents((list) => [saved, ...list]);
      showToast("Restored");
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, item: EventItem) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const patch = {
      text: String(fd.get("text") || "").trim(),
      date: String(fd.get("date") || ""),
      person: String(fd.get("person") || "").trim() || "Me",
      type: String(fd.get("type") || "").trim().toLowerCase(),
      category: toCategory(fd.get("category")),
      tz: tz(),
    };
    if (!patch.text) return;
    try {
      const { event: saved } = await api<{ event: EventItem }>(`/api/events/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setEvents((list) => list.map((x) => (x.id === saved.id ? saved : x)));
      setEditingId(null);
      showToast("Changes saved");
    } catch (e) {
      showToast((e as Error).message);
    }
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setQuery(q);
    const seq = ++askSeq.current;
    setAsking(true);
    setAnswer(null);
    try {
      const result = await api<Answer>("/api/ask", { method: "POST", body: JSON.stringify({ question: q, tz: tz() }) });
      if (seq === askSeq.current) setAnswer(result);
    } catch (e) {
      if (seq === askSeq.current) setAnswer({ headline: "Try again", answer: (e as Error).message, ids: [] });
    } finally {
      if (seq === askSeq.current) setAsking(false);
    }
  }

  async function togglePin(type: string, checked: boolean) {
    const base = pinned.length ? pinned : tileTypes;
    const next = checked ? Array.from(new Set([...base, type])) : base.filter((t) => t !== type);
    setPinned(next);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ pinned: next }) });
    } catch {
      showToast("Couldn't save your picks. Try again.");
    }
  }

  function pickTile(type: string) {
    setTypeFilter((cur) => (cur === type ? null : type));
    setFilter("all");
    if (typeFilter !== type) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      timelineHead.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" }).catch(() => undefined);
    window.location.href = "/login";
  }

  // ---------- render ----------
  const hour = now?.getHours() ?? 9;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayIso = now ? iso(localToday()) : undefined;
  const matched = answer ? answer.ids.map((id) => events.find((e) => e.id === id)).filter((e): e is EventItem => !!e) : [];

  return (
    <div className="wrap">
      <header>
        <div className="top">
          <div className="brand">
            <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="11" fill="#1E1B4B" /><circle cx="18" cy="18" r="9" fill="none" stroke="#6D68C4" strokeWidth="1.6" strokeDasharray="2 3" /><path d="M18 12v6l4 2.5" stroke="#FFFFFF" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="25.5" cy="10.5" r="3.5" fill="#FF7A59" /></svg>
            Whenly
          </div>
          <div className="top-right">
            {now ? <span className="pill">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span> : null}
            <button type="button" className="signout" onClick={signOut}>Sign out</button>
          </div>
        </div>
        <h1 className="hello">{greeting}, Vijay<span>.</span></h1>
        <p className="sub">{events.length ? `${events.length} ${events.length === 1 ? "moment" : "moments"} remembered, big and small.` : "Every moment, big and small, in one place."}</p>
      </header>

      <main className="layout">
        <section className="card add" aria-labelledby="add-h">
          <div className="head">
            <span className="badge" style={{ background: "var(--purchase-tint)", color: "var(--purchase-ink)" }} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>
            </span>
            <div>
              <h2 id="add-h">What happened?</h2>
              <p>Write it like a text. Add a date only if it wasn&apos;t today.</p>
            </div>
          </div>
          <form className="addrow" onSubmit={addMemory} autoComplete="off">
            <label className="sr" htmlFor="addText">Describe what happened</label>
            <input ref={addInput} className="field main" id="addText" placeholder="Rohan had a fever yesterday" maxLength={400} value={addText} onChange={(e) => setAddText(e.target.value)} />
            <label className="datebox" htmlFor="addDate">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
              <span>When</span>
              <input type="date" id="addDate" max={todayIso} value={addDate} onChange={(e) => setAddDate(e.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit" disabled={adding}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              <span>{adding ? "Reading…" : "Remember this"}</span>
            </button>
          </form>
          {events.length === 0 ? (
            <div className="hint">
              <span>Try:</span>
              {EXAMPLES.map((x) => (
                <button key={x} type="button" className="ex" onClick={() => { setAddText(x); addInput.current?.focus(); }}>{x}</button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="ask" aria-labelledby="ask-h">
          <svg className="rings" aria-hidden="true" width="280" height="280" viewBox="0 0 280 280"><circle cx="140" cy="140" r="60" fill="none" stroke="var(--ask-ring)" strokeWidth="1.5" /><circle cx="140" cy="140" r="95" fill="none" stroke="var(--ask-ring)" strokeWidth="1.5" /><circle cx="140" cy="140" r="130" fill="none" stroke="var(--ask-ring)" strokeWidth="1.5" /><circle cx="73" cy="207" r="7" fill="var(--coral)" /><circle cx="56" cy="114" r="4" fill="var(--accent)" /><circle cx="96" cy="182" r="3" fill="var(--care-dot)" /></svg>
          <div className="inner">
            <span className="eyebrow">Ask anything</span>
            <h2 id="ask-h">When was<br />the last time<span>?</span></h2>
            <form className="askbar" onSubmit={(e) => { e.preventDefault(); ask(query); }} autoComplete="off">
              <label className="sr" htmlFor="askText">Ask a question about your memories</label>
              <input id="askText" placeholder="When did my kid last have fever?" maxLength={300} value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="go" type="submit" aria-label="Ask" disabled={asking}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </form>
            <div aria-live="polite">
              {asking ? (
                <div className="answer"><div className="thinking"><i /><i /><i /><span>Looking through your memories…</span></div></div>
              ) : answer ? (
                <div className="answer">
                  <div className="k"><span>Answer</span><button type="button" onClick={() => { askSeq.current++; setAnswer(null); setQuery(""); }}>Clear</button></div>
                  <div className="big">{answer.headline}</div>
                  {answer.answer ? <div className="txt">{answer.answer}</div> : null}
                  {matched.map((e) => (
                    <div className="m" key={e.id}>
                      <span className="dot" style={{ background: `var(--${e.category}-dot)` }} />
                      <span>{e.text}</span>
                      <time dateTime={e.date}>{fmt(e.date)}</time>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="suggs">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="sugg" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          </div>
        </section>

        <section className="since" aria-labelledby="since-h">
          <div className="sechead">
            <h2 id="since-h">It&apos;s been…</h2>
            {types.length ? (
              <button className="link" type="button" aria-expanded={picking} onClick={() => setPicking((p) => !p)}>{picking ? "Done" : "Choose"}</button>
            ) : null}
          </div>
          <div className="tiles">
            {tileTypes.length === 0 ? (
              <div className="empty" style={{ gridColumn: "1 / -1" }}>Once you add a few memories, you&apos;ll see how long it has been since each one here.</div>
            ) : (
              tileTypes.map((type) => {
                const e = sorted.find((x) => x.type === type);
                if (!e) return null;
                const d = daysSince(e.date);
                const big = d >= 730 ? Math.round(d / 365) : d >= 60 ? Math.round(d / 30) : d;
                const unit = d >= 730 ? "years" : d >= 60 ? "months" : d === 1 ? "day" : "days";
                return (
                  <button key={type} type="button" className="tile" aria-pressed={typeFilter === type} style={catStyle(e.category)} onClick={() => pickTile(type)}>
                    <span className="ic"><Icon category={e.category} size={18} /></span>
                    <span className="n">{d <= 0 ? "Today" : big}</span>
                    <span className="u">{d <= 0 ? "" : unit}</span>
                    <span className="l">since {type}</span>
                    <span className="d">{e.person !== "Me" ? `${e.person}, ` : ""}{fmt(e.date)}</span>
                  </button>
                );
              })
            )}
          </div>
          {picking ? (
            <div className="picker">
              <p>Pick what you want to keep an eye on. With nothing picked, the things you log most often show up.</p>
              <div className="opts">
                {types.map((type, i) => (
                  <label key={type} className="opt" htmlFor={`pin${i}`}>
                    <input type="checkbox" id={`pin${i}`} checked={tileTypes.includes(type)} onChange={(e) => togglePin(type, e.target.checked)} />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="tl" aria-labelledby="tl-h">
          <div className="sechead">
            <h2 className="big" id="tl-h" ref={timelineHead}>Timeline</h2>
            <span className="count">{shown.length} {shown.length === 1 ? "memory" : "memories"}</span>
          </div>
          <div className="chips" role="group" aria-label="Filter by category">
            <button type="button" className="chip" aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setTypeFilter(null); }}>
              <span className="dot" style={{ width: 10, height: 10, background: "currentColor" }} />All<small>{events.length}</small>
            </button>
            {CATEGORY_KEYS.filter((k) => categoryCounts[k]).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => { setFilter(k); setTypeFilter(null); }}>
                <span className="dot" style={{ width: 10, height: 10, background: `var(--${k}-dot)` }} />{CATEGORY_LABELS[k]}<small>{categoryCounts[k]}</small>
              </button>
            ))}
          </div>
          {typeFilter ? (
            <div className="typefilter">Showing only <b>{typeFilter}</b> <button type="button" className="link" onClick={() => setTypeFilter(null)}>Show all</button></div>
          ) : null}
          {shown.length === 0 ? (
            <div className="empty" style={{ marginTop: 12 }}>{events.length ? "Nothing in this filter yet." : "Your timeline is empty. Your first memory is one sentence away."}</div>
          ) : (
            <>
              <datalist id="dl-people">{people.map((p) => <option key={p} value={p} />)}</datalist>
              <datalist id="dl-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
              {groups.map((g) => (
                <div className="month" key={g.key}>
                  <h3>{g.month}<small>{g.year}</small></h3>
                  <ol className="list">
                    {g.items.map((e) => (
                      <li key={e.id}>
                        {editingId === e.id ? (
                          <form className="edit" onSubmit={(ev) => saveEdit(ev, e)}>
                            <label className="full" htmlFor="ed-text">What happened<input className="field" id="ed-text" name="text" defaultValue={e.text} maxLength={400} required autoFocus /></label>
                            <label htmlFor="ed-date">When<input className="field" type="date" id="ed-date" name="date" defaultValue={e.date} max={todayIso} required /></label>
                            <label htmlFor="ed-person">Who<input className="field" id="ed-person" name="person" list="dl-people" defaultValue={e.person} maxLength={40} /></label>
                            <label htmlFor="ed-type">Kind of event<input className="field" id="ed-type" name="type" list="dl-types" defaultValue={e.type} maxLength={40} /></label>
                            <label htmlFor="ed-cat">Category
                              <select className="field" id="ed-cat" name="category" defaultValue={e.category}>
                                {CATEGORY_KEYS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                              </select>
                            </label>
                            <div className="row"><span /><span style={{ display: "flex", gap: 8 }}><button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button><button type="submit" className="btn btn-primary">Save changes</button></span></div>
                          </form>
                        ) : (
                          <div className="ev" style={catStyle(e.category)}>
                            <span className="badge"><Icon category={e.category} size={22} /></span>
                            <div className="body">
                              <div className="t">{e.text}</div>
                              {confirmingId === e.id ? (
                                <div className="confirm" style={{ marginTop: 8 }}>
                                  <span>Delete this memory?</span>
                                  <button type="button" className="btn btn-danger" onClick={() => removeMemory(e)}>Delete</button>
                                  <button type="button" className="btn btn-ghost" onClick={() => setConfirmingId(null)}>Keep</button>
                                </div>
                              ) : (
                                <div className="meta">
                                  <span className="tag">{e.type || CATEGORY_LABELS[e.category]}</span>
                                  <span>{e.person}</span>
                                  <span aria-hidden="true">·</span>
                                  <time dateTime={e.date}>{fmt(e.date)}, {ago(e.date)}</time>
                                </div>
                              )}
                            </div>
                            {confirmingId === e.id ? null : (
                              <div className="acts">
                                <button type="button" className="icb" aria-label={`Edit: ${e.text}`} onClick={() => { setEditingId(e.id); setConfirmingId(null); }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></svg>
                                </button>
                                <button type="button" className="icb" aria-label={`Delete: ${e.text}`} onClick={() => setConfirmingId(e.id)}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13" /></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </>
          )}
        </section>
      </main>

      {toast ? (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.actions.map((a) => (
            <button key={a.label} type="button" onClick={() => { setToast(null); a.run(); }}>{a.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
