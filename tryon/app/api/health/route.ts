import { json } from "@/lib/http.ts";
import { storeKind } from "@/lib/store.ts";
import { unitBalance, youcamConfigured } from "@/lib/youcam.ts";

export const dynamic = "force-dynamic";

/** Proves the YouCam key works (unit balance read, costs nothing) and shows the storage backend. */
export async function GET() {
  let youcam: { ok: boolean; units?: number; error?: string } = { ok: false, error: "not configured" };
  if (youcamConfigured()) {
    try { youcam = { ok: true, units: await unitBalance() }; } catch (e) { youcam = { ok: false, error: (e as Error).message }; }
  }
  return json({ ok: true, youcam, store: storeKind });
}
