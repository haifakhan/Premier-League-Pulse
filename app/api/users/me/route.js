import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

const UPDATABLE_FIELDS = ["username", "avatarUrl", "bio", "favoriteTeamId"];

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true,
  bio: true,
  role: true,
  isBanned: true,
  favoriteTeamId: true,
  createdAt: true,
  updatedAt: true,
};

export async function PATCH(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const payload = requireAuth(request);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, username: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = {};

    for (const field of UPDATABLE_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) {
        continue;
      }

      const value = body[field];
      data[field] = typeof value === "string" ? value.trim() : value;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "At least one updatable field is required" },
        { status: 400 }
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(data, "username") &&
      data.username !== currentUser.username
    ) {
      if (!data.username) {
        return NextResponse.json(
          { error: "Username cannot be empty" },
          { status: 400 }
        );
      }

      const existingUsernameUser = await prisma.user.findUnique({
        where: { username: data.username },
        select: { id: true },
      });

      if (existingUsernameUser) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: payload.id },
      data,
      select: SAFE_USER_SELECT,
    });

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unauthorized" },
      { status: 401 }
    );
  }
}
