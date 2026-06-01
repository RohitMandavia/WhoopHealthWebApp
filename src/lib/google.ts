import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
}

export async function getAuthedClient(userId: string) {
  const token = await prisma.googleToken.findUnique({ where: { userId } });
  if (!token) throw new Error("not_connected");

  const oauth2 = getOAuthClient();
  oauth2.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  if (token.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const { credentials } = await oauth2.refreshAccessToken();
    await prisma.googleToken.update({
      where: { userId },
      data: {
        accessToken: credentials.access_token!,
        expiresAt: new Date(credentials.expiry_date!),
      },
    });
    oauth2.setCredentials(credentials);
  }

  return oauth2;
}
