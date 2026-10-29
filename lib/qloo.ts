/**
 * Qloo Taste AI client (server only) for the "Taste Picks" agent.
 *
 * The agent turns a pot's own spending history into Qloo signals:
 *  - every merchant the group already paid (or asked to pay) is resolved to a Qloo place entity
 *  - those entities become `signal.interests.entities` for /v2/insights
 *  - the pot's remaining money per member caps `filter.price_level.max`
 * Qloo then returns places in the trip's location that people with that taste also like.
 */
import type { Category, Pot } from "./types";

const KEY = process.env.QLOO_API_KEY;
const BASE = (process.env.QLOO_API_BASE || "https://hackathon.api.qloo.com").replace(/\/+$/, "");

export const qlooConfigured = () => !!KEY;

export class QlooNotConfigured extends Error {
  constructor() {
    super("Taste Picks not configured: set QLOO_API_KEY");
  }
}

/** Pot categories Taste Picks can suggest for, and the Qloo place tag each maps to. */
export const TASTE_CATEGORIES: Partial<Record<Category, string>> = {
  food: "urn:tag:genre:place:restaurant",
  stay: "urn:tag:genre:place:hotel",
  activities: "urn:tag:genre:place:tourist_attraction",
};

export interface TastePick {
  entityId: string;
  name: string;
  address?: string;
  priceLevel?: number;
  rating?: number;
  affinity?: number;
  tags: string[];
  keywords: string[];
  image?: string;
  website?: string;
}

export interface TasteResult {
  location: string;
  category: Category;
  seeds: { name: string; entityId: string; address?: string }[];
  maxPriceLevel: number;
  perHeadBudget: number; // minor units
  picks: TastePick[];
  policyAllowsCategory: boolean;
}

/** Per-person money left -> Qloo price level ceiling (1 cheap .. 4 expensive). Thresholds in major units. */
export function priceLevelFor(perHeadMajor: number): number {
  if (perHeadMajor <= 8) return 1;
  if (perHeadMajor <= 20) return 2;
  if (perHeadMajor <= 45) return 3;
  return 4;
}

/** Merchant names the group has already chosen, newest first, de-duplicated, skipping rejected bills. */
export function seedNames(pot: Pick<Pot, "spends">, category?: Category, max = 3): string[] {
  const out: string[] = [];
  const spends = [...pot.spends].filter((s) => s.status !== "rejected").sort((a, b) => b.createdAt - a.createdAt);
  // Same-category merchants first, then any merchant, so a new category still carries the group's taste.
  const ordered = category ? [...spends.filter((s) => s.category === category), ...spends.filter((s) => s.category !== category)] : spends;
  for (const s of ordered) {
    const n = (s.payeeName || "").trim();
    if (n && !out.some((o) => o.toLowerCase() === n.toLowerCase())) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

async function qloo(path: string, params: Record<string, string | number>, timeoutMs = 15_000): Promise<any> {
  if (!KEY) throw new QlooNotConfigured();
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${path}?${qs}`, { headers: { [process.env.QLOO_AUTH_HEADER || "X-Api-Key"]: KEY, accept: "application/json" }, signal: ctrl.signal, cache: "no-store" });
    const text = await r.text();
    if (!r.ok) throw new Error(`Qloo error ${r.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("Qloo timed out");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a merchant name to a Qloo place, preferring one whose address mentions the trip location. */
export async function resolvePlace(name: string, location: string): Promise<{ name: string; entityId: string; address?: string } | null> {
  const d = await qloo("/search", { query: name, types: "urn:entity:place", take: 10 });
  const results: any[] = Array.isArray(d?.results) ? d.results : [];
  if (!results.length) return null;
  const loc = norm(location);
  const best = results.find((r) => norm(String(r?.properties?.address ?? "")).includes(loc)) ?? (loc ? null : results[0]);
  if (!best) return null;
  return { name: best.name, entityId: best.entity_id, address: best.properties?.address };
}

export function toPick(e: any): TastePick {
  const p = e?.properties ?? {};
  return {
    entityId: e.entity_id,
    name: e.name,
    address: p.address,
    priceLevel: typeof p.price_level === "number" ? p.price_level : undefined,
    rating: typeof p.business_rating === "number" ? Math.round(p.business_rating * 10) / 10 : undefined,
    affinity: typeof e?.query?.affinity === "number" ? Math.round(e.query.affinity * 100) / 100 : undefined,
    tags: (Array.isArray(e?.tags) ? e.tags : [])
      .map((t: any) => t?.name)
      .filter((n: unknown) => typeof n === "string" && n !== "Place")
      .slice(0, 4),
    keywords: (Array.isArray(p.keywords) ? p.keywords : []).map((k: any) => k?.name).filter(Boolean).slice(0, 3),
    image: Array.isArray(p.images) && p.images[0]?.url ? p.images[0].url : undefined,
    website: typeof p.website === "string" ? p.website : undefined,
  };
}

/** The Taste Picks agent: pot history + money left -> Qloo insights for the trip location. */
export async function tastePicks(pot: Pot, location: string, category: Category, take = 5): Promise<TasteResult> {
  const tag = TASTE_CATEGORIES[category];
  if (!tag) throw new Error(`Taste Picks covers ${Object.keys(TASTE_CATEGORIES).join(", ")}`);
  const loc = location.trim();
  if (loc.length < 2) throw new Error("Tell the agent where the group is (a city or area)");

  const { computeLedger } = await import("./ledger");
  const ledger = computeLedger(pot);
  const heads = Math.max(1, pot.members.length);
  const perHeadBudget = Math.max(0, Math.floor(ledger.totals.potBalance / heads));
  const maxPriceLevel = priceLevelFor(perHeadBudget / 100);

  const names = seedNames(pot, category);
  const resolved = await Promise.all(names.map((n) => resolvePlace(n, loc).catch(() => null)));
  const seeds = resolved.filter((s): s is NonNullable<typeof s> => !!s);

  const params: Record<string, string | number> = {
    "filter.type": "urn:entity:place",
    "filter.location.query": loc,
    "filter.tags": tag,
    "filter.price_level.max": maxPriceLevel,
    take: take + seeds.length,
  };
  if (seeds.length) params["signal.interests.entities"] = seeds.map((s) => s.entityId).join(",");

  const d = await qloo("/v2/insights", params, 20_000);
  const seedIds = new Set(seeds.map((s) => s.entityId));
  const entities: any[] = Array.isArray(d?.results?.entities) ? d.results.entities : [];
  const picks = entities
    .filter((e) => !seedIds.has(e.entity_id))
    .map(toPick)
    .slice(0, take);

  return {
    location: loc,
    category,
    seeds,
    maxPriceLevel,
    perHeadBudget,
    picks,
    policyAllowsCategory: pot.policy.allowedCategories.includes(category),
  };
}
