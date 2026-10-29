import { Redis } from "@upstash/redis";
import type { AuditEntry, Pot } from "./types";
import { demoPot, DEMO_POT_ID } from "./seed";

// Accepts the Vercel Marketplace (KV_*) names or Upstash's own names.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Persistence. Upstash Redis when configured (works on Vercel); otherwise an
 * in-memory map for local development (data resets on restart).
 */
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

const mem = globalThis as unknown as { __chaipot?: Map<string, Pot> };
mem.__chaipot ??= new Map();
const local = mem.__chaipot;

// STORE_PREFIX lets a second deployment (e.g. the Qloo build) share one Redis without touching the original pots.
const PREFIX = process.env.STORE_PREFIX || "chaipot";
const key = (id: string) => `${PREFIX}:pot:${id}`;

export const storeKind = redis ? "redis" : "memory";

export async function getPot(id: string): Promise<Pot | null> {
  const pot = redis ? ((await redis.get<Pot>(key(id))) ?? null) : structuredClone(local.get(id) ?? null);
  if (!pot && id === DEMO_POT_ID) {
    const fresh = demoPot();
    await savePot(fresh);
    return fresh;
  }
  return pot;
}

export async function savePot(p: Pot): Promise<void> {
  if (redis) await redis.set(key(p.id), p);
  else local.set(p.id, structuredClone(p));
}

export async function resetDemo(): Promise<Pot> {
  const fresh = demoPot();
  await savePot(fresh);
  return fresh;
}

export function newId(bytes = 8): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Buffer.from(arr).toString("base64url");
}

export function audit(p: Pot, e: Omit<AuditEntry, "id" | "at">): AuditEntry {
  const entry: AuditEntry = { id: newId(), at: Date.now(), ...e };
  p.audit.unshift(entry);
  if (p.audit.length > 300) p.audit.length = 300;
  return entry;
}
export { DEMO_POT_ID as DEMO_POT_ID_EXPORT } from "./seed";
