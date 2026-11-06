import "server-only";
import { Redis } from "@upstash/redis";
import type { Group } from "./types";

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const PREFIX = "splitsol:";
const redis = URL_?.startsWith("https://") && TOKEN ? new Redis({ url: URL_, token: TOKEN }) : null;

const mem = globalThis as unknown as { __splitsol?: Map<string, unknown> };
mem.__splitsol ??= new Map();
const local = mem.__splitsol;

export const storeKind = redis ? "upstash" : "memory";

async function get<T>(k: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(PREFIX + k)) ?? null;
  return (local.get(k) as T) ?? null;
}
async function set(k: string, v: unknown, ttlSec?: number) {
  if (redis) {
    if (ttlSec) await redis.set(PREFIX + k, v, { ex: ttlSec });
    else await redis.set(PREFIX + k, v);
    return;
  }
  local.set(k, structuredClone(v));
  if (ttlSec) setTimeout(() => local.delete(k), ttlSec * 1000).unref?.();
}

export const isGroupId = (id: string) => /^[A-Za-z0-9_-]{6,40}$/.test(id);

export async function getGroup(id: string): Promise<Group | null> {
  if (!isGroupId(id)) return null;
  return get<Group>(`group:${id}`);
}
export async function saveGroup(g: Group) {
  await set(`group:${g.id}`, g);
}

/** Simple once-per-window limiter; returns false when the key was used recently. */
export async function takeOnce(key: string, ttlSec: number): Promise<boolean> {
  if (redis) {
    const r = await redis.set(PREFIX + "rl:" + key, 1, { nx: true, ex: ttlSec });
    return r === "OK";
  }
  if (local.has("rl:" + key)) return false;
  await set("rl:" + key, 1, ttlSec);
  return true;
}

export function newId(bytes = 9): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}
