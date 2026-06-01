import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state") ?? "";

  if (error || !code) {
    const desc = searchParams.get("error_description") ?? error ?? "no_code";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(desc)}`, req.url));
  }

  // Extract userId from state (format: "<random>.<userId>")
  const userId = state.includes(".") ? state.split(".").slice(1).join(".") : null;
  if (!userId) {
    return NextResponse.redirect(new URL("/?error=whoop_invalid_state", req.url));
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
  });

  const tokenRes = await fetch("https://api.prod.whoop.com/oauth/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("[whoop/callback] Token exchange failed:", tokenRes.status, text);
    return NextResponse.redirect(new URL("/?error=whoop_token_failed", req.url));
  }

  const tokens = await tokenRes.json();

  await prisma.whoopToken.upsert({
    where: { userId },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    create: {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return NextResponse.redirect(new URL("/?connected=whoop", req.url));
}
