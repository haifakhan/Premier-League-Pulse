import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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
    const { content } = body || {};

    if (!isNonEmptyString(content)) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        content: true,
        authorId: true,
        isDeleted: true,
        isHidden: true,
        thread: {
          select: { status: true, isDeleted: true, isHidden: true },
        },
      },
    });

    if (!post || post.isDeleted || post.isHidden) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (
      post.thread?.status === "CLOSED" ||
      post.thread?.isDeleted ||
      post.thread?.isHidden
    ) {
      return NextResponse.json({ error: "Thread is closed" }, { status: 409 });
    }

    if (post.authorId !== payload.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const trimmedContent = content.trim();
    if (trimmedContent === post.content) {
      const current = await prisma.post.findUnique({
        where: { id: post.id },
        select: {
          id: true,
          content: true,
          kind: true,
          parentPostId: true,
          updatedAt: true,
        },
      });
      return NextResponse.json({ post: current }, { status: 200 });
    }

    await prisma.$transaction([
      prisma.postRevision.create({
        data: {
          postId: post.id,
          editorUserId: payload.id,
          previousContent: post.content,
        },
      }),
      prisma.post.update({
        where: { id: post.id },
        data: { content: trimmedContent },
      }),
    ]);

    const updated = await prisma.post.findUnique({
      where: { id: post.id },
      select: {
        id: true,
        content: true,
        kind: true,
        parentPostId: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ post: updated }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to update post";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request, context) {
  const params = await context.params;

  try {
    const payload = requireAuth(request);

    const post = await prisma.post.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        authorId: true,
        isDeleted: true,
        isHidden: true,
        thread: {
          select: { status: true, isDeleted: true, isHidden: true },
        },
      },
    });

    if (!post || post.isDeleted || post.isHidden) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (
      post.thread?.status === "CLOSED" ||
      post.thread?.isDeleted ||
      post.thread?.isHidden
    ) {
      return NextResponse.json({ error: "Thread is closed" }, { status: 409 });
    }

    if (post.authorId !== payload.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedByUserId: payload.id,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message = error?.message || "Failed to delete post";
    const status = message.includes("Authorization") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
