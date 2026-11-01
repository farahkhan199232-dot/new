import { Redis } from "@upstash/redis";
import type { Group } from "./shg.ts";
import { demoGroup, DEMO_GROUP_ID } from "./seed.ts";

/** Persistence: Upstash Redis on Vercel, in-memory map locally. */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = URL_ && TOKEN ? new Redis({ url: URL_, token: TOKEN }) : null;
const mem = globalThis as unknown as { __shg?: Map<string, Group> };
mem.__shg ??= new Map();
const key = (id: string) => `chaipot:shg:${id}`;

/** Current month in India, "YYYY-MM". */
export function thisMonth(d = new Date()): string {
  const ist = new Date(d.getTime() + 330 * 60_000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getGroup(id: string): Promise<Group | null> {
  const g = redis ? ((await redis.get<Group>(key(id))) ?? null) : structuredClone(mem.__shg!.get(id) ?? null);
  if (!g && id === DEMO_GROUP_ID) return resetDemo();
  return g;
}

export async function saveGroup(g: Group): Promise<void> {
  if (redis) await redis.set(key(g.id), g);
  else mem.__shg!.set(g.id, structuredClone(g));
}

export async function resetDemo(): Promise<Group> {
  const g = demoGroup(thisMonth());
  await saveGroup(g);
  return g;
}

export function newId(bytes = 6): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString("base64url");
}
