import "server-only";
import { Redis } from "@upstash/redis";
import type { GiftPot } from "./types.ts";
import { demoPot, DEMO_POT_ID } from "./seed.ts";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PREFIX = process.env.STORE_PREFIX || "cptryon";

/** Upstash Redis on Vercel; an in-memory map for local development. */
const redis = URL_ && TOKEN ? new Redis({ url: URL_, token: TOKEN }) : null;
const g = globalThis as unknown as { __cpt?: Map<string, unknown> };
g.__cpt ??= new Map();
const mem = g.__cpt;

export const storeKind = redis ? "redis" : "memory";
const k = (s: string) => `${PREFIX}:${s}`;
const IMG_TTL = 60 * 60 * 24 * 45; // 45 days, covers judging

async function get<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(k(key))) ?? null;
  return (structuredClone(mem.get(key)) as T) ?? null;
}
async function set(key: string, v: unknown, ttl?: number) {
  if (redis) await (ttl ? redis.set(k(key), v, { ex: ttl }) : redis.set(k(key), v));
  else mem.set(key, structuredClone(v));
}

export async function getPot(id: string): Promise<GiftPot | null> {
  const pot = await get<GiftPot>(`pot:${id}`);
  if (!pot && id === DEMO_POT_ID) {
    const fresh = demoPot();
    await savePot(fresh);
    return fresh;
  }
  return pot;
}
export const savePot = (p: GiftPot) => set(`pot:${p.id}`, p);
export async function resetDemo(): Promise<GiftPot> {
  const fresh = demoPot();
  await savePot(fresh);
  return fresh;
}

/** The recipient photo (base64 JPEG). Kept server-side, never in the pot JSON. */
export const savePhoto = (potId: string, b64: string) => set(`photo:${potId}`, b64, IMG_TTL);
export const getPhoto = (potId: string) => get<string>(`photo:${potId}`);

/** Result images (try-ons, masks): YouCam result URLs expire after ~2h, so we keep a copy. */
export async function saveImage(id: string, contentType: string, bytes: Uint8Array) {
  await set(`img:${id}`, { ct: contentType, b64: Buffer.from(bytes).toString("base64") }, IMG_TTL);
  return `/api/img/${id}`;
}
export const getImage = (id: string) => get<{ ct: string; b64: string }>(`img:${id}`);

/** Daily cap on live YouCam tasks so a public demo can't drain the free units. */
export async function takeLiveQuota(n = 1): Promise<{ ok: boolean; used: number; cap: number }> {
  const cap = Number(process.env.LIVE_TASKS_PER_DAY || 40);
  const day = new Date().toISOString().slice(0, 10);
  const key = `quota:${day}`;
  let used: number;
  if (redis) {
    used = await redis.incrby(k(key), n);
    if (used === n) await redis.expire(k(key), 60 * 60 * 48);
  } else {
    used = ((mem.get(key) as number) || 0) + n;
    mem.set(key, used);
  }
  return { ok: used <= cap, used, cap };
}
