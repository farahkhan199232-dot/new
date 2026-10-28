import { getPot, savePot } from "./store";
import type { Pot } from "./types";
import { PayPalError, PayPalNotConfigured } from "./paypal";
import { GeminiNotConfigured } from "./gemini";

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export function fail(e: unknown) {
  if (e instanceof PayPalNotConfigured) return json({ error: e.message, code: "paypal_not_configured" }, 503);
  if (e instanceof GeminiNotConfigured) return json({ error: e.message, code: "ai_not_configured" }, 503);
  if (e instanceof PayPalError) return json({ error: e.message, debugId: e.debugId }, e.status >= 500 ? 502 : 400);
  return json({ error: (e as Error).message || "Something went wrong" }, 400);
}

type Ctx = { params: Promise<{ id: string }> };

/** Load pot, run fn, save. fn returns the response payload (pot is always included). */
export function withPot(fn: (pot: Pot, body: any, req: Request) => Promise<unknown>) {
  return async (req: Request, { params }: Ctx) => {
    try {
      const { id } = await params;
      const pot = await getPot(id);
      if (!pot) return json({ error: "Pot not found" }, 404);
      const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
      const extra = await fn(pot, body, req);
      await savePot(pot);
      return json({ pot, ...(extra && typeof extra === "object" ? extra : {}) });
    } catch (e) {
      return fail(e);
    }
  };
}
