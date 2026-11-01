import { NextResponse } from "next/server";
import type { Ev } from "@/lib/shg.ts";
import { applyEvent, balanceText, computeState, groupSummary } from "@/lib/shg.ts";
import { interpret } from "@/lib/agent.ts";
import { getGroup, newId, resetDemo, saveGroup, thisMonth } from "@/lib/store.ts";
import { DEMO_GROUP_ID } from "@/lib/seed.ts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function view(id: string) {
  const g = await getGroup(id);
  if (!g) return null;
  const month = thisMonth();
  const state = computeState(g, month);
  return {
    group: g, month, state,
    summary: { en: groupSummary(g, month, "en"), hi: groupSummary(g, month, "hi") },
    balances: Object.fromEntries(g.members.map((m) => [m.id, { en: balanceText(g, m.id, month, "en"), hi: balanceText(g, m.id, month, "hi") }])),
  };
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const v = await view(id);
  return v ? NextResponse.json(v) : NextResponse.json({ error: "Group not found" }, { status: 404 });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const g = await getGroup(id);
  if (!g) return NextResponse.json({ error: "Group not found" }, { status: 404 });
  const by = String(body.by || g.members.find((m) => m.role === "treasurer")?.id || g.members[0]?.id);
  if (!g.members.some((m) => m.id === by)) return NextResponse.json({ error: "Unknown recorder" }, { status: 400 });

  if (body.op === "say") {
    const text = String(body.text || "").slice(0, 500).trim();
    if (!text) return NextResponse.json({ error: "Say something" }, { status: 400 });
    const reply = await interpret(text, g, thisMonth(), by, { ev: newId(), loan: "L" + newId(3) });
    return NextResponse.json(reply);
  }
  if (body.op === "confirm") {
    const ev = body.ev as Ev;
    if (!ev || typeof ev !== "object") return NextResponse.json({ error: "No entry" }, { status: 400 });
    // The recorder and month are set by the server, never trusted from the client.
    const clean = { ...ev, by, month: thisMonth(), at: new Date().toISOString(), id: newId() } as Ev;
    try {
      await saveGroup(applyEvent(g, clean));
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 422 });
    }
    return NextResponse.json(await view(id));
  }
  if (body.op === "reset" && id === DEMO_GROUP_ID) {
    await resetDemo();
    return NextResponse.json(await view(id));
  }
  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
