import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATE_COOKIE_NAME = "google_oauth_state";

function clearStateCookie(response) {
  response.cookies.set(STATE_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function redirectWithError(request, errorCode) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("oauthError", errorCode);
  const response = NextResponse.redirect(loginUrl);
  clearStateCookie(response);
  return response;
}

function normalizeUsernameSeed(input) {
  const value = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!value) {
    return "user";
  }

  return value.slice(0, 24);
}

async function getUniqueUsername(baseSeed) {
  const base = normalizeUsernameSeed(baseSeed);

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${attempt + 1}`;
    const availableBaseLength = Math.max(1, 24 - suffix.length);
    const candidate = `${base.slice(0, availableBaseLength)}${suffix}`;

    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `user_${randomBytes(4).toString("hex").slice(0, 8)}`;
}

async function fetchGoogleToken({ code, clientId, clientSecret, redirectUri }) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    return null;
  }

  const tokenPayload = await tokenResponse.json().catch(() => null);
  if (!tokenPayload || typeof tokenPayload.access_token !== "string") {
    return null;
  }

  return tokenPayload.access_token;
}

async function fetchGoogleProfile(accessToken) {
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!profileResponse.ok) {
    return null;
  }

  return profileResponse.json().catch(() => null);
}

async function getOrCreateOAuthUser(profile) {
  const email = typeof profile?.email === "string" ? profile.email.trim() : "";
  const emailVerified = profile?.email_verified === true;

  if (!email || !emailVerified) {
    return null;
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true, email: true, role: true },
  });

  if (existingUser) {
    return existingUser;
  }

  const usernameSeed = profile?.name || email.split("@")[0] || "user";
  const generatedPassword = randomBytes(24).toString("hex");
  const passwordHash = await hashPassword(generatedPassword);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const username = await getUniqueUsername(
      attempt === 0 ? usernameSeed : `${usernameSeed}_${attempt + 1}`
    );

    try {
      const createdUser = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash,
          avatarUrl: typeof profile?.picture === "string" ? profile.picture : null,
          role: "REGULAR",
          isBanned: false,
        },
        select: { id: true, email: true, role: true },
      });

      return createdUser;
    } catch (error) {
      if (error?.code === "P2002") {
        const racedUser = await prisma.user.findFirst({
          where: {
            email: {
              equals: email,
              mode: "insensitive",
            },
          },
          select: { id: true, email: true, role: true },
        });

        if (racedUser) {
          return racedUser;
        }
        continue;
      }

      throw error;
    }
  }

  return null;
}

export async function GET(request) {
  const callbackUrl = new URL(request.url);
  const code = callbackUrl.searchParams.get("code");
  const state = callbackUrl.searchParams.get("state");
  const storedState = request.cookies.get(STATE_COOKIE_NAME)?.value;

  if (!state || !storedState || state !== storedState) {
    return redirectWithError(request, "invalid_state");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return redirectWithError(request, "oauth_config");
  }

  if (!code) {
    return redirectWithError(request, "missing_code");
  }

  try {
    const accessToken = await fetchGoogleToken({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    if (!accessToken) {
      return redirectWithError(request, "token_exchange");
    }

    const profile = await fetchGoogleProfile(accessToken);
    if (!profile) {
      return redirectWithError(request, "profile_fetch");
    }

    const user = await getOrCreateOAuthUser(profile);
    if (!user) {
      return redirectWithError(request, "unverified_email");
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const successUrl = new URL("/login", request.url);
    successUrl.hash = `oauthToken=${encodeURIComponent(token)}`;

    const response = NextResponse.redirect(successUrl);
    clearStateCookie(response);
    return response;
  } catch {
    return redirectWithError(request, "oauth_failed");
  }
}
