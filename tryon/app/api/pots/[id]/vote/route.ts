import { withPot } from "@/lib/http.ts";
import { vote } from "@/lib/pot.ts";

export const POST = withPot(async (pot, body) => {
  vote(pot, String(body.memberId), String(body.proposalId));
  return {};
});
