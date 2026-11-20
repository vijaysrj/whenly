import Link from "next/link";
import { CATEGORY_KEYS, CATEGORY_LABELS, type Category } from "@/lib/categories";
import { Icon, LogoMark } from "./Icons";

// Sample content for the landing page only; none of it is real data.
const STEPS: { n: string; title: string; text: string }[] = [
  { n: "1", title: "Say it in a sentence", text: "“Rohan had a fever yesterday.” Add a date only if you want to. Whenly works it out from the words." },
  { n: "2", title: "Claude files it", text: "Each memory gets a kind of event, a person and a category. “Hair trimmed” and “went to the barber” both count as a haircut." },
  { n: "3", title: "Ask whenever", text: "Questions in plain words, answered from your own timeline, with the memories that back them up." },
];

const TILES: { cat: Category; n: string; unit: string; label: string }[] = [
  { cat: "care", n: "24", unit: "days", label: "Since a haircut" },
  { cat: "health", n: "3", unit: "months", label: "Since a health checkup" },
  { cat: "home", n: "7", unit: "weeks", label: "Since a car service" },
  { cat: "family", n: "2", unit: "years", label: "Since a family trip" },
];

const QUESTIONS = [
  "When did my kid last have fever?",
  "When was my last haircut?",
  "How many times did the kids fall sick this year?",
  "When did I buy the land?",
];

const CATEGORY_EXAMPLES: Record<Category, string> = {
  health: "Fevers, doctor visits, checkups",
  care: "Haircuts, grooming, fitness",
  purchase: "Phones, furniture, gifts",
  home: "Land, repairs, car service",
  family: "Weddings, funerals, trips",
  other: "Anything else worth remembering",
};

export default function Landing() {
  return (
    <div className="landing">
      <section className="band band-hero">
        <nav className="top">
          <div className="brand"><LogoMark />Whenly</div>
          <Link className="btn btn-ghost" href="/login">Sign in</Link>
        </nav>
        <div className="hero">
          <div>
            <span className="eyebrow">Your life, on a timeline</span>
            <h1>Remember <span>when.</span></h1>
            <p className="lede">From a haircut to buying land, jot down what happened in one sentence. Later, just ask: &ldquo;When did my kid last have fever?&rdquo;</p>
            <div className="ctas">
              <Link className="btn btn-coral" href="/login">Open my memories</Link>
              <a className="btn btn-ghost" href="#how">See how it works</a>
            </div>
          </div>
          <div className="preview" aria-hidden="true">
            <div className="q">When did my kid last have fever?</div>
            <div className="a">
              <div className="k">Answer</div>
              <div className="big">24 days ago</div>
              <div className="txt">Rohan had a fever on 27 Oct 2026. Before that, 2 Aug 2026.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="band band-steps" id="how">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n}>
              <span className="num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="band band-since">
        <div className="split">
          <div>
            <h2>It&rsquo;s been&hellip;</h2>
            <p>See at a glance how long it has been since the things you care about. Pin the ones you want, or let Whenly show what you log most.</p>
          </div>
          <div className="tiles">
            {TILES.map((t) => (
              <div key={t.label} className="tile" style={{ "--tint": `var(--${t.cat}-tint)`, "--tink": `var(--${t.cat}-ink)` } as React.CSSProperties}>
                <span className="ic"><Icon category={t.cat} size={20} /></span>
                <span className="n">{t.n}</span>
                <span className="u">{t.unit}</span>
                <span className="l">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="band band-ask">
        <h2>Ask anything</h2>
        <p>No search terms to remember. Ask the way you&rsquo;d ask a friend.</p>
        <div className="qs">
          {QUESTIONS.map((q) => <span key={q} className="qchip">{q}</span>)}
        </div>
      </section>

      <section className="band band-cats">
        <h2>From tiny things to big ones</h2>
        <ul className="cats">
          {CATEGORY_KEYS.map((c) => (
            <li key={c} style={{ "--tint": `var(--${c}-tint)`, "--tink": `var(--${c}-ink)` } as React.CSSProperties}>
              <span className="badge"><Icon category={c} size={22} /></span>
              <span><b>{CATEGORY_LABELS[c]}</b><small>{CATEGORY_EXAMPLES[c]}</small></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="band band-cta">
        <h2>Start remembering today.</h2>
        <p>Private to you, behind your own password.</p>
        <Link className="btn btn-coral" href="/login">Sign in to Whenly</Link>
      </section>
    </div>
  );
}
