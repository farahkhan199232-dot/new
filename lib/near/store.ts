import { Redis } from "@upstash/redis";
import { NEAR_CONTRACT } from "./config";
import type { VerdictLog } from "./types";

/** Off-chain audit log of the agent's full verdicts (the chain stores each verdict's sha256). */
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = URL_ && TOKEN ? new Redis({ url: URL_, token: TOKEN }) : null;
const mem = globalThis as unknown as { __cpnear?: Map<string, VerdictLog> };
mem.__cpnear ??= new Map();

const key = (pot: number, spend: number) => `chaipot:near:${NEAR_CONTRACT}:${pot}:${spend}`;
const lockKey = (pot: number, spend: number) => `${key(pot, spend)}:lock`;

export async function saveVerdict(v: VerdictLog) {
  if (redis) await redis.set(key(v.potId, v.spendId), v);
  else mem.__cpnear!.set(key(v.potId, v.spendId), v);
}

export async function getVerdicts(pot: number, spendIds: number[]): Promise<Record<number, VerdictLog>> {
  if (!spendIds.length) return {};
  const keys = spendIds.map((s) => key(pot, s));
  const vals = redis ? await redis.mget<(VerdictLog | null)[]>(...keys) : keys.map((k) => mem.__cpnear!.get(k) ?? null);
  const out: Record<number, VerdictLog> = {};
  vals.forEach((v, i) => {
    if (v) out[spendIds[i]] = v;
  });
  return out;
}

/** One reviewer per spend at a time (the contract also rejects a second review). */
export async function lockSpend(pot: number, spend: number): Promise<boolean> {
  if (!redis) {
    const k = lockKey(pot, spend);
    if (mem.__cpnear!.has(k)) return false;
    mem.__cpnear!.set(k, {} as VerdictLog);
    setTimeout(() => mem.__cpnear!.delete(k), 90_000);
    return true;
  }
  return (await redis.set(lockKey(pot, spend), 1, { nx: true, ex: 90 })) === "OK";
}
