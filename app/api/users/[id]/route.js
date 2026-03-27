import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";

export async function GET(_request, context) {
  const params = await context.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        favoriteTeamId: true,
        createdAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
          },
        },
        threads: {
          where: {
            isHidden: false,
            isDeleted: false,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        },
        posts: {
          where: {
            isHidden: false,
            isDeleted: false,
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            threadId: true,
            parentPostId: true,
            kind: true,
            thread: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const responseUser = {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      favoriteTeamId: user.favoriteTeamId,
      createdAt: user.createdAt,
      followerCount: user._count.followers,
      followingCount: user._count.following,
      threads: user.threads,
      posts: user.posts.map((post) => ({
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        threadId: post.threadId,
        parentPostId: post.parentPostId,
        kind: post.kind,
        threadTitle: post.thread?.title ?? null,
      })),
    };

    return NextResponse.json({ user: responseUser }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}
