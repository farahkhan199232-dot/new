import { withPot } from "@/lib/http";
import { handleReceipt, requireMember } from "@/lib/agent";

export const maxDuration = 120;

/** Body: { actor, image: base64 (no data: prefix), mimeType }. Max ~4 MB. */
export const POST = withPot(async (pot, b) => {
  const actor = requireMember(pot, b.actor);
  const mime = String(b.mimeType ?? "");
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(mime)) throw new Error("Upload a JPEG, PNG, WebP or HEIC photo");
  const image = String(b.image ?? "");
  if (!image || image.length > 5_500_000) throw new Error("Image missing or too large (max ~4 MB)");
  const entry = await handleReceipt(pot, actor, image, mime);
  return { receiptId: entry.id };
});
