import { withPot } from "@/lib/http.ts";
import { chipIn } from "@/lib/pot.ts";

/** Demo payment: records the member's equal share. No money moves. */
export const POST = withPot(async (pot, body) => ({ contribution: chipIn(pot, String(body.memberId)) }));
