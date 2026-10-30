import { withPot } from "@/lib/http.ts";
import { getPhoto, savePhoto } from "@/lib/store.ts";
import { audit } from "@/lib/pot.ts";

/** Body: { dataUrl: "data:image/jpeg;base64,..." } (the browser resizes to <= 1280px first). */
export const POST = withPot(async (pot, body) => {
  if (pot.demo) throw new Error("The demo pot uses its own sample photo. Start your own pot to upload one.");
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl || ""));
  if (!m) throw new Error("Send a JPEG or PNG photo");
  if (m[2].length > 4_000_000) throw new Error("Photo is too large; it should be under 3 MB");
  await savePhoto(pot.id, m[2]);
  pot.hasPhoto = true;
  pot.profile = undefined;
  audit(pot, "photo", `Photo of ${pot.recipient} added`);
  return {};
});

/** The recipient photo, for the pot page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b64 = await getPhoto(id);
  if (!b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(b64, "base64"), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=60" } });
}
