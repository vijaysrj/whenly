export const CATEGORY_KEYS = ["health", "care", "purchase", "home", "family", "other"] as const;
export type Category = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  health: "Health",
  care: "Personal care",
  purchase: "Purchases",
  home: "Home & property",
  family: "Family & life",
  other: "Other",
};

export function toCategory(value: unknown): Category {
  return (CATEGORY_KEYS as readonly string[]).includes(String(value)) ? (value as Category) : "other";
}

export type EventItem = {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
  type: string;
  category: Category;
  person: string;
  createdAt: string;
};

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Today's date as YYYY-MM-DD in the given IANA time zone. */
export function todayIn(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
