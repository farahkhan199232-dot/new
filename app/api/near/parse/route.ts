import { parseRequest } from "@/lib/near/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 40;

export async function POST(req: Request) {
  try {
    const { text, categories, accounts } = await req.json();
    if (!text || typeof text !== "string") return Response.json({ error: "text required" }, { status: 400 });
    const parsed = await parseRequest(text, Array.isArray(categories) ? categories.slice(0, 12) : [], Array.isArray(accounts) ? accounts.slice(0, 20) : []);
    return Response.json({ parsed });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
