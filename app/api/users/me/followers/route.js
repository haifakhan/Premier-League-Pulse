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
    const followers = await prisma.follow.findMany({
      where: { followingId: authUserId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        follower: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    const users = followers.map((entry) => ({
      id: entry.follower.id,
      username: entry.follower.username,
      avatarUrl: entry.follower.avatarUrl,
      followedAt: entry.createdAt,
    }));

    return NextResponse.json({ users }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch followers list" },
      { status: 500 }
    );
  }
}
