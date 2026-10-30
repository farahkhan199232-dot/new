import { withPot } from "@/lib/http.ts";
import { analyze } from "@/lib/service.ts";

export const maxDuration = 60;

/** Body: { live?: boolean }. Demo pot defaults to the cached real result unless live is set. */
export const POST = withPot(async (pot, body, req) => {
  const profile = await analyze(pot, new URL(req.url).origin, Boolean(body.live) || !pot.demo);
  return { profile };
});
