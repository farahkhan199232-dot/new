import { NextResponse } from "next/server";
export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const ok = (data: unknown) => NextResponse.json(data, { headers: { "cache-control": "no-store" } });
export const clean = (s: unknown, max = 60) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");
