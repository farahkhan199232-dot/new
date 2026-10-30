import "server-only";
import { getPot, savePot } from "./store.ts";
import type { GiftPot } from "./types.ts";
import { YouCamError } from "./youcam.ts";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export function fail(e: unknown) {
  if (e instanceof YouCamError) return json({ error: e.message, code: e.code }, e.status);
  return json({ error: (e as Error).message || "Something went wrong" }, 400);
}

type Ctx = { params: Promise<{ id: string }> };

/** Load the pot, run fn, save it, and return the pot plus anything fn returns. */
export function withPot(fn: (pot: GiftPot, body: any, req: Request) => Promise<unknown>) {
  return async (req: Request, { params }: Ctx) => {
    try {
      const { id } = await params;
      const pot = await getPot(id);
      if (!pot) return json({ error: "Gift pot not found" }, 404);
      const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
      const extra = await fn(pot, body, req);
      if (req.method !== "GET") await savePot(pot);
      return json({ pot, ...(extra && typeof extra === "object" ? extra : {}) });
    } catch (e) {
      return fail(e);
    }
  };
}
