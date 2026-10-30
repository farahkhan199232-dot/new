import { withPot } from "@/lib/http.ts";
import { lockVote } from "@/lib/pot.ts";

export const POST = withPot(async (pot, body) => ({ winner: lockVote(pot, String(body.memberId)) }));
