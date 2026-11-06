import { MINT, TREASURY } from "@/lib/config";
import { ok } from "@/lib/http";
import { storeKind } from "@/lib/store";
export async function GET() {
  return ok({ ok: true, cluster: "devnet", mint: MINT, treasury: TREASURY, store: storeKind, faucet: !!process.env.MINT_AUTHORITY_SECRET });
}
