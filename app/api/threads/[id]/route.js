import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(_request, context) {
  const params = await context.params;
  try {
    const thread = await prisma.thread.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        forumType: true,
        teamId: true,
        matchId: true,
        status: true,
        createdAt: true,
        isDeleted: true,
        isHidden: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
        threadTags: { select: { tag: { select: { name: true } } } },
        posts: {
          where: { isDeleted: false, isHidden: false },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            kind: true,
            createdAt: true,
            author: { select: { id: true, username: true, avatarUrl: true } },
            parentPostId: true,
          },
        },
      },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    const rootPost = thread.posts.find((post) => post.kind === "ROOT") || null;
    const replies = thread.posts.filter((post) => post.kind === "REPLY");

    const response = {
      id: thread.id,
      title: thread.title,
      forumType: thread.forumType,
      teamId: thread.teamId,
      matchId: thread.matchId,
      status: thread.status,
      createdAt: thread.createdAt,
      author: thread.author,
      tags: thread.threadTags.map((t) => t.tag.name),
      rootPost,
      replies,
    };

    return NextResponse.json({ thread: response }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, context) {
  const params = await context.params;
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const payload = requireAuth(request);
    const { title, content } = body || {};

    const hasTitle = isNonEmptyString(title);
    const hasContent = isNonEmptyString(content);

    if (!hasTitle && !hasContent) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const thread = await prisma.thread.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        authorId: true,
        title: true,
        status: true,
        isDeleted: true,
        isHidden: true,
        posts: {
          where: { kind: "ROOT" },
          select: { id: true, content: true },
          take: 1,
        },
      },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (thread.status === "CLOSED") {
      return NextResponse.json({ error: "Thread is closed" }, { status: 409 });
    }

    if (thread.authorId !== payload.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rootPost = thread.posts[0];
    if (!rootPost) {
      return NextResponse.json(
        { error: "Root post not found" },
        { status: 404 }
      );
    }

    const updatedTitle = hasTitle ? title.trim() : null;
    const updatedContent = hasContent ? content.trim() : null;

    await prisma.$transaction(async (tx) => {
      if (updatedTitle && updatedTitle !== thread.title) {
        await tx.thread.update({
          where: { id: thread.id },
          data: { title: updatedTitle },
        });
      }

      if (updatedContent && updatedContent !== rootPost.content) {
        await tx.postRevision.create({
          data: {
            postId: rootPost.id,
            editorUserId: payload.id,
            previousContent: rootPost.content,
          },
        });

        await tx.post.update({
          where: { id: rootPost.id },
          data: { content: updatedContent },
        });
      }
    });

    const refreshed = await prisma.thread.findUnique({
      where: { id: thread.id },
      select: {
        id: true,
        title: true,
        forumType: true,
        teamId: true,
        matchId: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, username: true, avatarUrl: true } },
        threadTags: { select: { tag: { select: { name: true } } } },
        posts: {
          where: { kind: "ROOT" },
          select: {
            id: true,
            content: true,
            kind: true,
            createdAt: true,
            author: { select: { id: true, username: true, avatarUrl: true } },
          },
          take: 1,
        },
      },
    });

    const response = {
      id: refreshed.id,
      title: refreshed.title,
      forumType: refreshed.forumType,
      teamId: refreshed.teamId,
      matchId: refreshed.matchId,
      status: refreshed.status,
      createdAt: refreshed.createdAt,
      author: refreshed.author,
      tags: refreshed.threadTags.map((t) => t.tag.name),
      rootPost: refreshed.posts[0] || null,
    };

    return NextResponse.json({ thread: response }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to update thread";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request, context) {
  const params = await context.params;

  try {
    const payload = requireAuth(request);

    const thread = await prisma.thread.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true, isDeleted: true, isHidden: true },
    });

    if (!thread || thread.isDeleted || thread.isHidden) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (thread.authorId !== payload.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deletedAt = new Date();

    await prisma.$transaction([
      prisma.thread.update({
        where: { id: thread.id },
        data: {
          isDeleted: true,
          deletedAt,
          deletedByUserId: payload.id,
        },
      }),
      prisma.post.updateMany({
        where: { threadId: thread.id },
        data: {
          isDeleted: true,
          deletedAt,
          deletedByUserId: payload.id,
        },
      }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to delete thread";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
