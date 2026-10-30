import { getImage } from "@/lib/store.ts";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) return new Response("Bad id", { status: 400 });
  const img = await getImage(id);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(img.b64, "base64"), {
    headers: { "Content-Type": img.ct, "Cache-Control": "public, max-age=86400, immutable" },
  });
}
