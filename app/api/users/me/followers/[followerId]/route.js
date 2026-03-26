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

export async function DELETE(request, context) {
  const authUserId = getAuthUserId(request);

  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const followerId = params.followerId;

  try {
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId,
          followingId: authUserId,
        },
      },
      select: { id: true },
    });

    if (!existingFollow) {
      return NextResponse.json(
        { error: "Follow relationship not found" },
        { status: 404 }
      );
    }

    await prisma.follow.delete({
      where: {
        followerId_followingId: {
          followerId,
          followingId: authUserId,
        },
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to remove follower" },
      { status: 500 }
    );
  }
}
