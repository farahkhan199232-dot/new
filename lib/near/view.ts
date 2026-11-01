import { NEAR_CONTRACT, NEAR_RPC } from "./config";
import type { NearPot, NearSpend } from "./types";

/** Minimal JSON-RPC client (works in browser and server, no SDK needed for reads). */
export async function rpc<T>(method: string, params: unknown): Promise<T> {
  const r = await fetch(NEAR_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "chaipot", method, params }),
    cache: "no-store",
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error.data?.toString?.() || d.error.message || "RPC error");
  return d.result as T;
}

export async function viewCall<T>(method: string, args: object = {}, contract = NEAR_CONTRACT): Promise<T> {
  const res = await rpc<{ result: number[]; error?: string }>("query", {
    request_type: "call_function",
    finality: "optimistic",
    account_id: contract,
    method_name: method,
    args_base64: btoa(JSON.stringify(args)),
  });
  if (res.error) throw new Error(res.error);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(res.result))) as T;
}

export const getPot = (id: number) => viewCall<NearPot | null>("get_pot", { pot_id: id });
export const getSpends = (id: number, limit = 50) => viewCall<NearSpend[]>("get_spends", { pot_id: id, from_index: 0, limit });
export const getPotCount = () => viewCall<number>("get_pot_count");

export async function viewAccount(id: string): Promise<{ amount: string; code_hash: string } | null> {
  try {
    return await rpc("query", { request_type: "view_account", finality: "final", account_id: id });
  } catch {
    return null;
  }
}

/** Decodes a function call's return value from a transaction outcome. */
export function returnValue<T>(outcome: { status?: unknown } | null | undefined): T | undefined {
  const st = outcome?.status as { SuccessValue?: string } | undefined;
  if (!st || typeof st.SuccessValue !== "string" || !st.SuccessValue) return undefined;
  try {
    return JSON.parse(atob(st.SuccessValue)) as T;
  } catch {
    return undefined;
  }
}
