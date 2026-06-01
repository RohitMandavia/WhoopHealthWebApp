import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUserId } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const userId = getCurrentUserId(req);
  if (!userId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Encode userId in state so the callback can associate the token with this user
  const random = randomBytes(8).toString("hex");
  const state = `${random}.${userId}`;

  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    response_type: "code",
    scope: "read:workout read:recovery read:cycles read:sleep offline",
    state,
  });

  const url = `https://api.prod.whoop.com/oauth/oauth2/auth?${params}`;
  return NextResponse.redirect(url);
}
