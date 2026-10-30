import { withPot } from "@/lib/http.ts";
import { tryOn } from "@/lib/service.ts";

export const maxDuration = 60;

/** Body: { memberId, productId, live?: boolean } */
export const POST = withPot(async (pot, body, req) => {
  const proposal = await tryOn(pot, String(body.memberId), String(body.productId), new URL(req.url).origin, Boolean(body.live) || !pot.demo);
  return { proposal };
});
