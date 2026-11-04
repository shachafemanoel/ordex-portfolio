import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
export type CorsRequest = Request | NextRequest;
export function setCors(res: NextResponse, req: CorsRequest) {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") || "";
  if (origin && allowed.includes(origin)) res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}
export function preflight(req: CorsRequest) {
  return setCors(new NextResponse(null, { status: 204 }), req);
}
