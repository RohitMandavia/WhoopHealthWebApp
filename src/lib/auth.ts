import { NextRequest } from "next/server";

export function getCurrentUserId(req: NextRequest): string | null {
  return req.cookies.get("userId")?.value ?? null;
}
