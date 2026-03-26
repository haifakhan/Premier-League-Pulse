import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function getAuthUserId(request) {
  try {
    const payload = requireAuth(request);
    return payload?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const authUserId = getAuthUserId(request);

  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const following = await prisma.follow.findMany({
      where: { followerId: authUserId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        following: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    const users = following.map((entry) => ({
      id: entry.following.id,
      username: entry.following.username,
      avatarUrl: entry.following.avatarUrl,
      followedAt: entry.createdAt,
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch following list" },
      { status: 500 }
    );
  }
}
