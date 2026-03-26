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

export async function POST(request, context) {
  const authUserId = getAuthUserId(request);

  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const targetUserId = params.id;

  if (targetUserId === authUserId) {
    return NextResponse.json(
      { error: "You cannot follow yourself" },
      { status: 400 }
    );
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: authUserId },
    select: { isBanned: true },
  });

  if (currentUser?.isBanned) {
    return NextResponse.json(
      { error: "Banned users cannot follow other users" },
      { status: 403 }
    );
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: authUserId,
          followingId: targetUserId,
        },
      },
      select: { id: true },
    });

    if (existingFollow) {
      return NextResponse.json(
        { error: "Already following this user" },
        { status: 409 }
      );
    }

    await prisma.follow.create({
      data: {
        followerId: authUserId,
        followingId: targetUserId,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "Already following this user" },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: "Failed to follow user" }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  const authUserId = getAuthUserId(request);

  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const targetUserId = params.id;

  try {
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: authUserId,
          followingId: targetUserId,
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
          followerId: authUserId,
          followingId: targetUserId,
        },
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to unfollow user" },
      { status: 500 }
    );
  }
}
